import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const anon = createClient(supabaseUrl, anonKey);
    const { data: { user: caller } } = await anon.auth.getUser(authHeader.replace("Bearer ", ""));
    if (!caller) return json({ error: "Unauthorized" }, 401);

    const { data: callerRoles } = await admin
      .from("user_roles").select("role").eq("user_id", caller.id);
    const roles = (callerRoles || []).map((r) => r.role);
    const isSuper = roles.includes("super_admin");
    const isAdmin = isSuper || roles.includes("admin");
    if (!isAdmin) return json({ error: "Forbidden" }, 403);

    const body = await req.json();
    const { action } = body;

    // Helper: get role map (admin sees no super_admin)
    const fetchRoleMap = async () => {
      const { data } = await admin.from("user_roles").select("user_id, role");
      const map: Record<string, string> = {};
      (data || []).forEach((r) => {
        // Highest role wins: super_admin > admin > user
        const cur = map[r.user_id];
        if (!cur || r.role === "super_admin" || (r.role === "admin" && cur === "user"))
          map[r.user_id] = r.role;
      });
      return map;
    };

    if (action === "list-users") {
      const { data: profiles } = await admin
        .from("profiles").select("*").order("created_at", { ascending: false });
      const roleMap = await fetchRoleMap();
      let list = (profiles || []).map((p) => ({ ...p, role: roleMap[p.id] || "user" }));
      // Admin can't see super_admin accounts at all
      if (!isSuper) list = list.filter((u) => u.role !== "super_admin");
      return json({ users: list });
    }

    if (action === "search-messages") {
      const { q } = body;
      if (!q || typeof q !== "string" || !q.trim()) return json({ messages: [] });
      const { data: msgs } = await admin
        .from("messages")
        .select("id, content, sender_id, conversation_id, created_at, message_type")
        .ilike("content", `%${q}%`)
        .eq("deleted", false)
        .order("created_at", { ascending: false })
        .limit(200);
      const senderIds = [...new Set((msgs || []).map((m) => m.sender_id))];
      const { data: senders } = await admin
        .from("profiles").select("id, display_name, username, avatar_url")
        .in("id", senderIds.length ? senderIds : ["00000000-0000-0000-0000-000000000000"]);
      const roleMap = await fetchRoleMap();
      const senderMap: Record<string, any> = {};
      (senders || []).forEach((s) => { senderMap[s.id] = s; });
      let list = (msgs || []).map((m) => ({
        ...m,
        sender: senderMap[m.sender_id],
        senderRole: roleMap[m.sender_id] || "user",
      }));
      if (!isSuper) list = list.filter((m) => m.senderRole !== "super_admin");
      return json({ messages: list });
    }

    if (action === "reset-password") {
      const { userId, newPassword } = body;
      if (!userId || !newPassword || newPassword.length < 6)
        return json({ error: "Invalid input" }, 400);
      // Admin can't reset super_admin's password
      if (!isSuper) {
        const { data: targetRoles } = await admin
          .from("user_roles").select("role").eq("user_id", userId);
        if ((targetRoles || []).some((r) => r.role === "super_admin"))
          return json({ error: "Forbidden" }, 403);
      }
      const { error } = await admin.auth.admin.updateUserById(userId, { password: newPassword });
      if (error) throw error;
      return json({ success: true });
    }

    if (action === "lock-user" || action === "unlock-user") {
      const { userId } = body;
      if (!userId) return json({ error: "Invalid input" }, 400);
      if (!isSuper) {
        const { data: targetRoles } = await admin
          .from("user_roles").select("role").eq("user_id", userId);
        if ((targetRoles || []).some((r) => r.role === "super_admin"))
          return json({ error: "Forbidden" }, 403);
      }
      const lock = action === "lock-user";
      await admin.from("profiles").update({ locked: lock }).eq("id", userId);
      await admin.auth.admin.updateUserById(userId, {
        ban_duration: lock ? "876600h" : "none",
      });
      return json({ success: true });
    }

    if (action === "set-role") {
      // Only super_admin can promote/demote admin<->user
      if (!isSuper) return json({ error: "Forbidden" }, 403);
      const { userId, role } = body;
      if (!userId || !["admin", "user"].includes(role))
        return json({ error: "Invalid input" }, 400);
      // Never modify super_admin via this endpoint
      const { data: tr } = await admin
        .from("user_roles").select("role").eq("user_id", userId);
      if ((tr || []).some((r) => r.role === "super_admin"))
        return json({ error: "Cannot modify super_admin" }, 403);
      await admin.from("user_roles").delete().eq("user_id", userId);
      await admin.from("user_roles").insert({ user_id: userId, role });
      return json({ success: true });
    }

    if (action === "view-user-conversations") {
      const { userId } = body;
      if (!userId) return json({ error: "Invalid input" }, 400);
      if (!isSuper) {
        const { data: tr } = await admin.from("user_roles").select("role").eq("user_id", userId);
        if ((tr || []).some((r) => r.role === "super_admin"))
          return json({ error: "Forbidden" }, 403);
      }
      const { data: members } = await admin
        .from("conversation_members").select("conversation_id").eq("user_id", userId);
      const convIds = (members || []).map((m) => m.conversation_id);
      if (convIds.length === 0) return json({ conversations: [], members: [], profiles: [] });
      const { data: convs } = await admin
        .from("conversations").select("*").in("id", convIds)
        .order("updated_at", { ascending: false });
      const { data: allMembers } = await admin
        .from("conversation_members").select("*").in("conversation_id", convIds);
      const memberUserIds = [...new Set((allMembers || []).map((m) => m.user_id))];
      const { data: profiles } = await admin
        .from("profiles").select("id, display_name, username, avatar_url, online")
        .in("id", memberUserIds.length ? memberUserIds : ["00000000-0000-0000-0000-000000000000"]);
      return json({ conversations: convs, members: allMembers, profiles });
    }

    if (action === "view-conversation-messages") {
      const { conversationId, userId } = body;
      if (!conversationId) return json({ error: "Invalid input" }, 400);
      if (userId && !isSuper) {
        const { data: tr } = await admin.from("user_roles").select("role").eq("user_id", userId);
        if ((tr || []).some((r) => r.role === "super_admin"))
          return json({ error: "Forbidden" }, 403);
      }
      const { data: msgs } = await admin
        .from("messages").select("*").eq("conversation_id", conversationId)
        .eq("deleted", false).order("created_at", { ascending: true }).limit(500);
      return json({ messages: msgs });
    }

    return json({ error: "Invalid action" }, 400);
  } catch (e: any) {
    return json({ error: e.message || "Server error" }, 500);
  }
});
