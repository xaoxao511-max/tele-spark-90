import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Shield, LogOut, Settings, Users, Search, Eye, Lock, Unlock, KeyRound, ShieldOff, ShieldCheck, MessageSquare, Loader2, X } from 'lucide-react';
import ChatAvatar from '@/components/chat/ChatAvatar';
import ChangePasswordDialog from '@/components/chat/ChangePasswordDialog';

interface StaffUser {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  online: boolean;
  locked: boolean;
  role: 'super_admin' | 'admin' | 'user';
  created_at: string;
}

interface MessageHit {
  id: string;
  content: string;
  conversation_id: string;
  sender_id: string;
  created_at: string;
  sender?: { display_name: string; username: string; avatar_url: string | null };
  senderRole: string;
}

const ControlPanelDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user, profile, roles, loading, signOut } = useAuth();
  const isSuper = roles.some(r => r.role === 'super_admin');
  const isStaff = isSuper || roles.some(r => r.role === 'admin');

  const [tab, setTab] = useState<'profiles' | 'settings'>('profiles');
  const [searchMode, setSearchMode] = useState<'user' | 'message'>('user');
  const [users, setUsers] = useState<StaffUser[]>([]);
  const [messages, setMessages] = useState<MessageHit[]>([]);
  const [query, setQuery] = useState('');
  const [loadingData, setLoadingData] = useState(true);
  const [searching, setSearching] = useState(false);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [resetTarget, setResetTarget] = useState<StaffUser | null>(null);
  const [resetPwd, setResetPwd] = useState('');

  useEffect(() => {
    if (!loading && !isStaff) {
      navigate('/control-panel', { replace: true });
    }
  }, [loading, isStaff, navigate]);

  const fetchUsers = async () => {
    setLoadingData(true);
    const { data, error } = await supabase.functions.invoke('staff-manage', {
      body: { action: 'list-users' },
    });
    if (error) toast.error(error.message);
    else setUsers(data?.users || []);
    setLoadingData(false);
  };

  useEffect(() => { if (isStaff) fetchUsers(); }, [isStaff]);

  const handleSearchMessages = async () => {
    if (!query.trim()) { setMessages([]); return; }
    setSearching(true);
    const { data, error } = await supabase.functions.invoke('staff-manage', {
      body: { action: 'search-messages', q: query.trim() },
    });
    if (error) toast.error(error.message);
    else setMessages(data?.messages || []);
    setSearching(false);
  };

  const handleToggleLock = async (u: StaffUser) => {
    if (!window.confirm(u.locked ? `Mở khóa @${u.username}?` : `Khóa tài khoản @${u.username}?`)) return;
    const { error } = await supabase.functions.invoke('staff-manage', {
      body: { action: u.locked ? 'unlock-user' : 'lock-user', userId: u.id },
    });
    if (error) toast.error(error.message);
    else { toast.success(u.locked ? 'Đã mở khóa' : 'Đã khóa tài khoản'); fetchUsers(); }
  };

  const handleSetRole = async (u: StaffUser, role: 'admin' | 'user') => {
    const { error } = await supabase.functions.invoke('staff-manage', {
      body: { action: 'set-role', userId: u.id, role },
    });
    if (error) toast.error(error.message);
    else { toast.success('Đã cập nhật vai trò'); fetchUsers(); }
  };

  const handleResetPassword = async () => {
    if (!resetTarget || resetPwd.length < 6) {
      toast.error('Mật khẩu phải có ít nhất 6 ký tự'); return;
    }
    const { error } = await supabase.functions.invoke('staff-manage', {
      body: { action: 'reset-password', userId: resetTarget.id, newPassword: resetPwd },
    });
    if (error) toast.error(error.message);
    else { toast.success('Đã đặt lại mật khẩu'); setResetTarget(null); setResetPwd(''); }
  };

  const filteredUsers = searchMode === 'user' && query
    ? users.filter(u =>
        u.display_name.toLowerCase().includes(query.toLowerCase()) ||
        u.username.toLowerCase().includes(query.toLowerCase()))
    : users;

  if (loading) return (
    <div className="h-screen flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
  if (!isStaff) return null;

  const roleBadge = (role: string) => {
    const map: Record<string, string> = {
      super_admin: 'bg-rose-500/20 text-rose-500 border-rose-500/30',
      admin: 'bg-amber-500/20 text-amber-600 border-amber-500/30',
      user: 'bg-secondary text-muted-foreground border-border',
    };
    const label: Record<string, string> = { super_admin: 'Super Admin', admin: 'Admin', user: 'User' };
    return <span className={`text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full border font-medium ${map[role]}`}>{label[role]}</span>;
  };

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {/* Header */}
      <div className="border-b border-border bg-tg-sidebar flex-shrink-0">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
          <Shield className="h-5 w-5 text-primary" />
          <div className="flex-1">
            <h1 className="font-display font-bold">Control Panel</h1>
            <p className="text-xs text-muted-foreground">{profile?.display_name} • {isSuper ? 'Super Admin' : 'Admin'}</p>
          </div>
          <button onClick={() => { signOut(); navigate('/control-panel'); }}
            className="p-2 rounded-lg hover:bg-tg-hover transition-colors text-muted-foreground hover:text-destructive"
            title="Đăng xuất">
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar tabs */}
        <div className="w-56 border-r border-border bg-tg-sidebar p-3 flex-shrink-0 hidden md:block">
          <button onClick={() => setTab('profiles')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium mb-1 transition-colors ${tab === 'profiles' ? 'bg-primary text-primary-foreground' : 'hover:bg-tg-hover'}`}>
            <Users className="h-4 w-4" /> Quản lý Users
          </button>
          <button onClick={() => setTab('settings')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${tab === 'settings' ? 'bg-primary text-primary-foreground' : 'hover:bg-tg-hover'}`}>
            <Settings className="h-4 w-4" /> Cài đặt
          </button>
        </div>

        {/* Mobile tabs */}
        <div className="md:hidden flex border-b border-border w-full fixed bottom-0 bg-tg-sidebar z-30">
          <button onClick={() => setTab('profiles')} className={`flex-1 py-3 text-sm flex flex-col items-center gap-1 ${tab === 'profiles' ? 'text-primary' : 'text-muted-foreground'}`}>
            <Users className="h-4 w-4" /> Users
          </button>
          <button onClick={() => setTab('settings')} className={`flex-1 py-3 text-sm flex flex-col items-center gap-1 ${tab === 'settings' ? 'text-primary' : 'text-muted-foreground'}`}>
            <Settings className="h-4 w-4" /> Cài đặt
          </button>
        </div>

        <div className="flex-1 overflow-y-auto pb-20 md:pb-0">
          {tab === 'settings' && (
            <div className="max-w-2xl mx-auto p-6 space-y-4">
              <h2 className="font-display font-semibold text-xl mb-4">Cài đặt tài khoản</h2>
              <div className="bg-card rounded-2xl border border-border p-5 space-y-3">
                <div className="flex items-center gap-4">
                  <ChatAvatar name={profile?.display_name || ''} avatarUrl={profile?.avatar_url} size="lg" />
                  <div>
                    <p className="font-semibold">{profile?.display_name}</p>
                    <p className="text-sm text-muted-foreground">@{profile?.username}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{user?.email}</p>
                  </div>
                </div>
                <div className="pt-3 border-t border-border">
                  {roleBadge(isSuper ? 'super_admin' : 'admin')}
                </div>
              </div>
              <button onClick={() => setShowPasswordDialog(true)}
                className="w-full bg-card border border-border rounded-2xl p-4 flex items-center gap-3 hover:bg-tg-hover transition-colors text-left">
                <KeyRound className="h-5 w-5 text-primary" />
                <div className="flex-1">
                  <p className="text-sm font-medium">Đổi mật khẩu</p>
                  <p className="text-xs text-muted-foreground">Cập nhật mật khẩu đăng nhập của bạn</p>
                </div>
              </button>
            </div>
          )}

          {tab === 'profiles' && (
            <div className="max-w-7xl mx-auto p-4 md:p-6">
              {/* Search bar */}
              <div className="mb-4 flex flex-col sm:flex-row gap-2">
                <div className="flex bg-secondary rounded-xl p-1 self-start">
                  <button onClick={() => { setSearchMode('user'); setQuery(''); }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${searchMode === 'user' ? 'bg-card shadow-sm' : 'text-muted-foreground'}`}>
                    Tìm user
                  </button>
                  <button onClick={() => { setSearchMode('message'); setQuery(''); setMessages([]); }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${searchMode === 'message' ? 'bg-card shadow-sm' : 'text-muted-foreground'}`}>
                    Tìm tin nhắn
                  </button>
                </div>
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && searchMode === 'message') handleSearchMessages(); }}
                    placeholder={searchMode === 'user' ? 'Tìm theo tên hoặc @username...' : 'Tìm theo nội dung tin nhắn... (Enter)'}
                    className="w-full bg-secondary rounded-xl pl-10 pr-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
                {searchMode === 'message' && (
                  <button onClick={handleSearchMessages} disabled={searching}
                    className="bg-primary text-primary-foreground rounded-xl px-4 py-2.5 text-sm font-medium disabled:opacity-50">
                    {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Tìm'}
                  </button>
                )}
              </div>

              {loadingData ? (
                <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
              ) : searchMode === 'message' ? (
                <div className="bg-card rounded-2xl border border-border overflow-hidden">
                  <div className="px-4 py-3 border-b border-border text-sm font-semibold">
                    Kết quả tin nhắn ({messages.length})
                  </div>
                  {messages.length === 0 ? (
                    <p className="p-8 text-center text-sm text-muted-foreground">Nhập từ khóa và nhấn Tìm</p>
                  ) : (
                    <div className="divide-y divide-border">
                      {messages.map(m => (
                        <div key={m.id} className="p-4 hover:bg-tg-hover transition-colors">
                          <div className="flex items-start gap-3">
                            <ChatAvatar name={m.sender?.display_name || '?'} avatarUrl={m.sender?.avatar_url || null} size="sm" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-sm font-medium truncate">{m.sender?.display_name}</span>
                                <span className="text-xs text-muted-foreground">@{m.sender?.username}</span>
                                {roleBadge(m.senderRole)}
                                <span className="text-xs text-muted-foreground ml-auto flex-shrink-0">{new Date(m.created_at).toLocaleString('vi-VN')}</span>
                              </div>
                              <p className="text-sm text-foreground/90 break-words">{m.content}</p>
                              <button onClick={() => navigate(`/control-panel/view-as/${m.sender_id}?conv=${m.conversation_id}`)}
                                className="text-xs text-primary hover:underline mt-1 inline-flex items-center gap-1">
                                <Eye className="h-3 w-3" /> Mở cuộc trò chuyện
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-card rounded-2xl border border-border overflow-hidden">
                  <div className="px-4 py-3 border-b border-border text-sm font-semibold">
                    Người dùng ({filteredUsers.length})
                  </div>
                  <div className="divide-y divide-border">
                    {filteredUsers.map(u => (
                      <div key={u.id} className="flex flex-wrap items-center gap-3 px-4 py-3 hover:bg-tg-hover transition-colors">
                        <ChatAvatar name={u.display_name} avatarUrl={u.avatar_url} online={u.online} size="sm" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-medium truncate">{u.display_name}</p>
                            {roleBadge(u.role)}
                            {u.locked && <span className="text-[10px] uppercase px-2 py-0.5 rounded-full border border-destructive/30 bg-destructive/10 text-destructive font-medium">Đã khóa</span>}
                          </div>
                          <p className="text-xs text-muted-foreground">@{u.username}</p>
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <button onClick={() => navigate(`/control-panel/view-as/${u.id}`)}
                            className="p-2 rounded-lg hover:bg-secondary transition-colors text-primary" title="Xem với tư cách user">
                            <Eye className="h-4 w-4" />
                          </button>
                          <button onClick={() => setResetTarget(u)}
                            className="p-2 rounded-lg hover:bg-secondary transition-colors" title="Đặt lại mật khẩu">
                            <KeyRound className="h-4 w-4" />
                          </button>
                          <button onClick={() => handleToggleLock(u)}
                            className={`p-2 rounded-lg hover:bg-secondary transition-colors ${u.locked ? 'text-emerald-500' : 'text-amber-500'}`}
                            title={u.locked ? 'Mở khóa' : 'Khóa tài khoản'}>
                            {u.locked ? <Unlock className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                          </button>
                          {isSuper && u.role !== 'super_admin' && u.id !== user?.id && (
                            u.role === 'admin' ? (
                              <button onClick={() => handleSetRole(u, 'user')}
                                className="p-2 rounded-lg hover:bg-secondary transition-colors text-rose-500"
                                title="Hạ quyền admin → user">
                                <ShieldOff className="h-4 w-4" />
                              </button>
                            ) : (
                              <button onClick={() => handleSetRole(u, 'admin')}
                                className="p-2 rounded-lg hover:bg-secondary transition-colors text-emerald-500"
                                title="Thăng quyền user → admin">
                                <ShieldCheck className="h-4 w-4" />
                              </button>
                            )
                          )}
                        </div>
                      </div>
                    ))}
                    {filteredUsers.length === 0 && (
                      <p className="p-8 text-center text-sm text-muted-foreground">Không tìm thấy user</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {showPasswordDialog && <ChangePasswordDialog onClose={() => setShowPasswordDialog(false)} />}

      {resetTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-card rounded-2xl border border-border p-6 w-full max-w-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-semibold">Đặt lại mật khẩu</h3>
              <button onClick={() => { setResetTarget(null); setResetPwd(''); }} className="p-1 hover:bg-secondary rounded-lg">
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-sm text-muted-foreground mb-3">Cho user <strong>@{resetTarget.username}</strong></p>
            <input type="text" value={resetPwd} onChange={e => setResetPwd(e.target.value)}
              placeholder="Mật khẩu mới (≥ 6 ký tự)"
              className="w-full bg-secondary rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30 mb-3" />
            <div className="flex gap-2">
              <button onClick={() => { setResetTarget(null); setResetPwd(''); }}
                className="flex-1 bg-secondary rounded-xl py-2.5 text-sm font-medium">Hủy</button>
              <button onClick={handleResetPassword}
                className="flex-1 bg-primary text-primary-foreground rounded-xl py-2.5 text-sm font-medium">Đặt lại</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ControlPanelDashboard;
