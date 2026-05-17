// FCM v1 push sender. Called from DB trigger when a new message is inserted.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { create, getNumericDate } from "https://deno.land/x/djwt@v3.0.2/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FCM_SA = JSON.parse(Deno.env.get("FCM_SERVICE_ACCOUNT") || "{}");

let cachedToken: { token: string; exp: number } | null = null;

// Convert PEM private key → CryptoKey
async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const b64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s+/g, "");
  const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  return await crypto.subtle.importKey(
    "pkcs8",
    bin.buffer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

async function getAccessToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.exp - 60 > now) return cachedToken.token;

  const key = await importPrivateKey(FCM_SA.private_key);
  const jwt = await create(
    { alg: "RS256", typ: "JWT" },
    {
      iss: FCM_SA.client_email,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: "https://oauth2.googleapis.com/token",
      iat: getNumericDate(0),
      exp: getNumericDate(3600),
    },
    key,
  );

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });
  const data = await res.json();
  if (!data.access_token) throw new Error("OAuth failed: " + JSON.stringify(data));
  cachedToken = { token: data.access_token, exp: now + (data.expires_in || 3600) };
  return data.access_token;
}

async function sendToToken(
  accessToken: string,
  token: string,
  title: string,
  body: string,
  data: Record<string, string>,
): Promise<{ ok: boolean; invalid?: boolean }> {
  const res = await fetch(
    `https://fcm.googleapis.com/v1/projects/${FCM_SA.project_id}/messages:send`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: {
          token,
          notification: { title, body },
          data,
          android: { priority: "HIGH", notification: { sound: "default" } },
          apns: { payload: { aps: { sound: "default", badge: 1 } } },
        },
      }),
    },
  );
  if (res.ok) return { ok: true };
  const err = await res.json().catch(() => ({}));
  const code = err?.error?.details?.[0]?.errorCode || err?.error?.status;
  const invalid = code === "UNREGISTERED" || code === "INVALID_ARGUMENT" ||
    code === "NOT_FOUND" || res.status === 404;
  console.error("[FCM] send error", res.status, JSON.stringify(err));
  return { ok: false, invalid };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { message_id } = await req.json();
    if (!message_id) {
      return new Response(JSON.stringify({ error: "message_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sb = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Load message
    const { data: msg, error: msgErr } = await sb
      .from("messages")
      .select("id, conversation_id, sender_id, content, message_type, file_name")
      .eq("id", message_id)
      .maybeSingle();
    if (msgErr || !msg) {
      return new Response(JSON.stringify({ error: "message not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Sender info
    const { data: sender } = await sb
      .from("profiles")
      .select("display_name, username")
      .eq("id", msg.sender_id)
      .maybeSingle();

    // Conversation + members (recipients = all members except sender, not muted)
    const { data: convo } = await sb
      .from("conversations")
      .select("id, type, name")
      .eq("id", msg.conversation_id)
      .maybeSingle();

    const { data: members } = await sb
      .from("conversation_members")
      .select("user_id, muted")
      .eq("conversation_id", msg.conversation_id);

    const recipientIds = (members || [])
      .filter((m) => m.user_id !== msg.sender_id && !m.muted)
      .map((m) => m.user_id);

    if (recipientIds.length === 0) {
      return new Response(JSON.stringify({ sent: 0, reason: "no recipients" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: tokens } = await sb
      .from("device_tokens")
      .select("token, user_id")
      .in("user_id", recipientIds);

    if (!tokens || tokens.length === 0) {
      return new Response(JSON.stringify({ sent: 0, reason: "no device tokens" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build notification content
    const senderName = sender?.display_name || sender?.username || "Tin nhắn mới";
    const title = convo?.type === "group" && convo?.name
      ? `${convo.name} • ${senderName}`
      : senderName;
    let body = msg.content || "";
    if (!body) {
      if (msg.message_type === "image") body = "📷 Hình ảnh";
      else if (msg.message_type === "video") body = "🎬 Video";
      else if (msg.message_type === "audio") body = "🎵 Tin nhắn thoại";
      else if (msg.message_type === "file") body = `📎 ${msg.file_name || "Tệp đính kèm"}`;
      else body = "Tin nhắn mới";
    }
    if (body.length > 120) body = body.slice(0, 117) + "...";

    const data = {
      conversation_id: String(msg.conversation_id),
      message_id: String(msg.id),
      sender_id: String(msg.sender_id),
    };

    const accessToken = await getAccessToken();

    let sent = 0;
    const invalidTokens: string[] = [];
    await Promise.all(
      tokens.map(async (t) => {
        const r = await sendToToken(accessToken, t.token, title, body, data);
        if (r.ok) sent++;
        else if (r.invalid) invalidTokens.push(t.token);
      }),
    );

    // Cleanup invalid tokens
    if (invalidTokens.length > 0) {
      await sb.from("device_tokens").delete().in("token", invalidTokens);
    }

    return new Response(
      JSON.stringify({ sent, total: tokens.length, removed: invalidTokens.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[send-push] error", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
