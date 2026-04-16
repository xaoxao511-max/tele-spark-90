import React, { useState, useRef } from 'react';
import { X, Camera } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import ChatAvatar from './ChatAvatar';

const EditProfileDialog: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { profile, user } = useAuth();
  const { t } = useLanguage();
  const [displayName, setDisplayName] = useState(profile?.display_name || '');
  const [username, setUsername] = useState(profile?.username || '');
  const [bio, setBio] = useState(profile?.bio || '');
  const [phoneNumber, setPhoneNumber] = useState((profile as any)?.phone_number || '');
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url || '');
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Ảnh tối đa 5MB');
      return;
    }
    if (!file.type.startsWith('image/')) {
      toast.error('Chỉ chấp nhận file ảnh');
      return;
    }
    setAvatarFile(file);
    const reader = new FileReader();
    reader.onload = () => setAvatarPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const uploadAvatar = async (): Promise<string | null> => {
    if (!avatarFile || !user) return avatarUrl || null;
    const ext = avatarFile.name.split('.').pop() || 'jpg';
    const path = `avatars/${user.id}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('chat-files').upload(path, avatarFile, { upsert: true });
    if (error) {
      toast.error('Upload ảnh thất bại: ' + error.message);
      return null;
    }
    const { data } = supabase.storage.from('chat-files').getPublicUrl(path);
    return data.publicUrl;
  };

  const handleSave = async () => {
    if (!user || !displayName.trim() || !username.trim()) {
      toast.error('Tên và username không được để trống');
      return;
    }
    setSaving(true);
    
    let finalAvatarUrl = avatarUrl || null;
    if (avatarFile) {
      const uploaded = await uploadAvatar();
      if (uploaded === null && avatarFile) {
        setSaving(false);
        return;
      }
      finalAvatarUrl = uploaded;
    }

    const { error } = await supabase.from('profiles').update({
      display_name: displayName.trim(),
      username: username.trim(),
      bio: bio.trim() || null,
      phone_number: phoneNumber.trim() || null,
      avatar_url: finalAvatarUrl,
    } as any).eq('id', user.id);
    if (error) {
      toast.error('Lỗi: ' + error.message);
    } else {
      toast.success('Đã cập nhật profile');
      onClose();
    }
    setSaving(false);
  };

  const currentAvatar = avatarPreview || avatarUrl || undefined;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-sm" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        onClick={e => e.stopPropagation()}
        className="bg-card rounded-2xl border border-border shadow-xl w-full max-w-sm p-6"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-semibold">{t('editProfile')}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-tg-hover transition-colors">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
        <div className="flex flex-col items-center mb-4">
          <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
            <ChatAvatar name={displayName || 'U'} avatar={currentAvatar} size="lg" />
            <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <Camera className="h-5 w-5 text-white" />
            </div>
          </div>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="mt-2 text-xs text-primary hover:underline"
          >
            Đổi ảnh đại diện
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleAvatarSelect}
          />
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium mb-1 block">{t('displayName')}</label>
            <input value={displayName} onChange={e => setDisplayName(e.target.value)} className="w-full bg-secondary rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">{t('username')}</label>
            <input value={username} onChange={e => setUsername(e.target.value)} className="w-full bg-secondary rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">{t('bio')}</label>
            <textarea value={bio} onChange={e => setBio(e.target.value)} rows={3} className="w-full bg-secondary rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30 resize-none" placeholder={t('aboutYou')} />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">{t('phoneNumber')}</label>
            <input value={phoneNumber} onChange={e => setPhoneNumber(e.target.value.replace(/[^0-9+\-\s]/g, ''))} placeholder="+84 xxx xxx xxx" className="w-full bg-secondary rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
          <button onClick={handleSave} disabled={saving} className="w-full bg-primary text-primary-foreground rounded-xl py-2.5 text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50">
            {saving ? t('saving') : t('save')}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default EditProfileDialog;
