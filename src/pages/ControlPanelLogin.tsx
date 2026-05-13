import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';
import { Shield, Eye, EyeOff, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';

const ControlPanelLogin: React.FC = () => {
  const navigate = useNavigate();
  const { user, roles, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      const isStaff = roles.some(r => r.role === 'admin' || r.role === 'super_admin');
      if (isStaff) navigate('/control-panel/dashboard', { replace: true });
    }
  }, [user, roles, loading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) { toast.error(error.message); setSubmitting(false); return; }
      // Verify role
      const { data: roleData } = await supabase
        .from('user_roles').select('role').eq('user_id', data.user!.id);
      const isStaff = (roleData || []).some(r => r.role === 'admin' || r.role === 'super_admin');
      if (!isStaff) {
        await supabase.auth.signOut();
        toast.error('Tài khoản không có quyền truy cập trang quản trị');
        setSubmitting(false);
        return;
      }
      toast.success('Đăng nhập quản trị thành công');
      navigate('/control-panel/dashboard', { replace: true });
    } catch (err: any) {
      toast.error(err.message || 'Lỗi đăng nhập');
    }
    setSubmitting(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-background to-primary/5">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Shield className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-2xl font-display font-bold">Control Panel</h1>
          <p className="text-muted-foreground text-sm mt-1">Khu vực quản trị • Chỉ dành cho Admin / Super Admin</p>
        </div>
        <div className="bg-card rounded-2xl p-6 shadow-xl border border-border">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Email quản trị</label>
              <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                placeholder="admin@example.com"
                className="w-full bg-secondary rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Mật khẩu</label>
              <div className="relative">
                <input type={showPassword ? 'text' : 'password'} required value={password}
                  onChange={e => setPassword(e.target.value)} placeholder="••••••••"
                  className="w-full bg-secondary rounded-xl px-4 py-2.5 pr-10 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
                <button type="button" onClick={() => setShowPassword(p => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <button type="submit" disabled={submitting}
              className="w-full bg-primary text-primary-foreground rounded-xl py-2.5 text-sm font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2">
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {submitting ? 'Đang xác thực...' : 'Đăng nhập'}
            </button>
          </form>
          <div className="mt-4 text-center">
            <button onClick={() => navigate('/auth')} className="text-xs text-muted-foreground hover:text-foreground">
              ← Quay về trang người dùng
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default ControlPanelLogin;
