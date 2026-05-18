import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ArrowLeft, Eye, Loader2, Search } from 'lucide-react';
import ChatAvatar from '@/components/chat/ChatAvatar';

interface Conv {
  id: string;
  type: 'private' | 'group' | 'channel';
  name: string | null;
  avatar_url: string | null;
  updated_at: string;
}

interface Member { conversation_id: string; user_id: string; }
interface ProfileLite { id: string; display_name: string; username: string; avatar_url: string | null; online: boolean; }
interface Msg {
  id: string; sender_id: string; content: string | null; created_at: string;
  message_type: string; file_url: string | null; file_name: string | null;
}

const ControlPanelViewAs: React.FC = () => {
  const { userId } = useParams<{ userId: string }>();
  const [searchParams] = useSearchParams();
  const initialConv = searchParams.get('conv');
  const navigate = useNavigate();
  const { roles, loading } = useAuth();
  const isStaff = roles.some(r => r.role === 'admin' || r.role === 'super_admin');

  const [conversations, setConversations] = useState<Conv[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [profiles, setProfiles] = useState<Record<string, ProfileLite>>({});
  const [activeConv, setActiveConv] = useState<string | null>(initialConv);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [target, setTarget] = useState<ProfileLite | null>(null);
  const [filter, setFilter] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!loading && !isStaff) navigate('/control-panel', { replace: true });
  }, [loading, isStaff, navigate]);

  useEffect(() => {
    if (!userId || !isStaff) return;
    (async () => {
      setLoadingData(true);
      const { data, error } = await supabase.functions.invoke('staff-manage', {
        body: { action: 'view-user-conversations', userId },
      });
      if (error) { toast.error(error.message); setLoadingData(false); return; }
      const profMap: Record<string, ProfileLite> = {};
      (data.profiles || []).forEach((p: ProfileLite) => { profMap[p.id] = p; });
      setProfiles(profMap);
      setMembers(data.members || []);
      setConversations(data.conversations || []);
      setTarget(profMap[userId] || null);
      if (!activeConv && data.conversations?.length) setActiveConv(data.conversations[0].id);
      setLoadingData(false);
    })();
  }, [userId, isStaff]);

  useEffect(() => {
    if (!activeConv || !userId) return;
    (async () => {
      setLoadingMsgs(true);
      const { data, error } = await supabase.functions.invoke('staff-manage', {
        body: { action: 'view-conversation-messages', conversationId: activeConv, userId },
      });
      if (error) toast.error(error.message);
      else setMessages(data.messages || []);
      setLoadingMsgs(false);
      setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }), 50);
    })();
  }, [activeConv, userId]);

  const getConvDisplay = (c: Conv) => {
    if (c.type !== 'private') return { name: c.name || 'Group', avatar: c.avatar_url };
    const convMembers = members.filter(m => m.conversation_id === c.id);
    const otherId = convMembers.find(m => m.user_id !== userId)?.user_id;
    // Saved Messages: chat với chính mình (chỉ có 1 member = userId)
    if (!otherId) {
      const self = profiles[userId!];
      return { name: 'Tin nhắn đã lưu', avatar: self?.avatar_url || null, online: false };
    }
    const p = profiles[otherId];
    return { name: p?.display_name || 'Unknown', avatar: p?.avatar_url || null, online: p?.online };
  };

  const filteredConvs = conversations.filter(c => {
    const d = getConvDisplay(c);
    return d.name.toLowerCase().includes(filter.toLowerCase());
  });

  if (loading || !isStaff) return (
    <div className="h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
  );

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {/* Banner */}
      <div className="bg-amber-500/10 border-b border-amber-500/30 px-4 py-2.5 flex items-center gap-3 flex-shrink-0">
        <button onClick={() => navigate('/control-panel/dashboard')}
          className="p-1.5 rounded-lg hover:bg-amber-500/20 text-amber-700 dark:text-amber-400">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <Eye className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-amber-800 dark:text-amber-300 truncate">
            Đang xem với tư cách <strong>{target?.display_name || '...'}</strong>
            {target && <span className="text-amber-700/70 dark:text-amber-400/70 ml-1.5">@{target.username}</span>}
          </p>
          <p className="text-[11px] text-amber-700/80 dark:text-amber-400/70">Chế độ chỉ đọc — không thể tương tác</p>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Conversation list */}
        <div className="w-72 border-r border-border bg-tg-sidebar flex flex-col flex-shrink-0">
          <div className="p-3 border-b border-border">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input value={filter} onChange={e => setFilter(e.target.value)}
                placeholder="Tìm cuộc trò chuyện..."
                className="w-full bg-secondary rounded-xl pl-9 pr-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {loadingData ? (
              <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
            ) : filteredConvs.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground p-6">Không có cuộc trò chuyện</p>
            ) : filteredConvs.map(c => {
              const d = getConvDisplay(c);
              return (
                <button key={c.id} onClick={() => setActiveConv(c.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 hover:bg-tg-hover transition-colors text-left ${activeConv === c.id ? 'bg-tg-hover' : ''}`}>
                  <ChatAvatar name={d.name} avatar={d.avatar || undefined} online={d.online} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{d.name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {c.type === 'private' ? 'Tin nhắn riêng' : c.type === 'group' ? 'Nhóm' : 'Kênh'}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 flex flex-col min-w-0 bg-tg-bg">
          {!activeConv ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
              Chọn một cuộc trò chuyện để xem
            </div>
          ) : loadingMsgs ? (
            <div className="flex-1 flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : (
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-2">
              {messages.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-8">Chưa có tin nhắn</p>
              ) : messages.map(m => {
                const isOwn = m.sender_id === userId;
                const sender = profiles[m.sender_id];
                return (
                  <div key={m.id} className={`flex gap-2 ${isOwn ? 'justify-end' : 'justify-start'}`}>
                    {!isOwn && <ChatAvatar name={sender?.display_name || '?'} avatar={sender?.avatar_url || undefined} size="sm" />}
                    <div className={`max-w-[70%] rounded-2xl px-3 py-2 ${isOwn ? 'bg-primary text-primary-foreground' : 'bg-card border border-border'}`}>
                      {!isOwn && <p className="text-xs font-medium text-primary mb-0.5">{sender?.display_name}</p>}
                      {m.message_type === 'image' && m.file_url ? (
                        <img src={m.file_url} alt="" className="rounded-lg max-h-64 mb-1" />
                      ) : m.message_type === 'video' && m.file_url ? (
                        <video src={m.file_url} controls className="rounded-lg max-h-64 mb-1" />
                      ) : m.message_type === 'file' ? (
                        <a href={m.file_url || '#'} target="_blank" rel="noreferrer" className="text-xs underline">{m.file_name || 'File'}</a>
                      ) : null}
                      {m.content && <p className="text-sm whitespace-pre-wrap break-words">{m.content}</p>}
                      <p className={`text-[10px] mt-1 opacity-60 ${isOwn ? 'text-right' : ''}`}>
                        {new Date(m.created_at).toLocaleString('vi-VN')}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {/* Disabled input bar */}
          <div className="border-t border-border bg-tg-sidebar px-4 py-3 flex-shrink-0">
            <div className="bg-secondary rounded-xl px-4 py-2.5 text-sm text-muted-foreground italic text-center">
              Chế độ xem — không thể gửi tin nhắn
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ControlPanelViewAs;
