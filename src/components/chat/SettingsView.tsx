import React, { useState } from 'react';
import { Moon, Sun, Ban, LogOut, KeyRound, Globe, ChevronRight, ArrowLeft, Edit2, X } from 'lucide-react';
import { useChatContext } from '@/context/ChatContext';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import ChangePasswordDialog from './ChangePasswordDialog';
import ChatAvatar from './ChatAvatar';
import EditProfileDialog from './EditProfileDialog';
import ProfileViewDialog from './ProfileViewDialog';
import { motion, AnimatePresence } from 'framer-motion';

const SettingsView: React.FC<{ onBack?: () => void }> = ({ onBack }) => {
  const { darkMode, toggleDarkMode, blockedUsers, profiles, unblockUser } = useChatContext();
  const { signOut, user, profile } = useAuth();
  const { lang, setLang, t } = useLanguage();
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [showLanguage, setShowLanguage] = useState(false);
  const [showBlocked, setShowBlocked] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showProfile, setShowProfile] = useState(false);

  const p = profiles[user?.id || ''] || profile;

  // Profile sub-view
  if (showProfile) {
    return (
      <div className="flex flex-col h-full bg-tg-sidebar">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
          <button onClick={() => setShowProfile(false)} className="p-2 rounded-lg hover:bg-tg-hover transition-colors">
            <ArrowLeft className="h-5 w-5 text-muted-foreground" />
          </button>
          <h2 className="font-display font-semibold text-lg">{t('profile')}</h2>
        </div>
        <div className="flex-1 overflow-y-auto scrollbar-thin">
          <div className="flex flex-col items-center px-6 py-8">
            <ChatAvatar name={p?.display_name || 'U'} avatar={p?.avatar_url || undefined} online={true} size="lg" />
            <h3 className="font-display font-semibold text-lg mt-4">{p?.display_name || 'User'}</h3>
            <p className="text-sm text-muted-foreground">@{p?.username}</p>
            {p?.bio && <p className="text-sm text-muted-foreground mt-2 text-center">{p.bio}</p>}
            {(p as any)?.phone_number && (
              <p className="text-sm text-muted-foreground mt-1">📞 {(p as any).phone_number}</p>
            )}
            <button
              onClick={() => setShowEditProfile(true)}
              className="mt-6 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              <Edit2 className="h-4 w-4" /> {t('editProfile')}
            </button>
          </div>
        </div>
        {showEditProfile && <EditProfileDialog onClose={() => setShowEditProfile(false)} />}
      </div>
    );
  }

  // Language sub-view
  if (showLanguage) {
    return (
      <div className="flex flex-col h-full bg-tg-sidebar">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
          <button onClick={() => setShowLanguage(false)} className="p-2 rounded-lg hover:bg-tg-hover transition-colors">
            <ArrowLeft className="h-5 w-5 text-muted-foreground" />
          </button>
          <h2 className="font-display font-semibold text-lg">{t('language')}</h2>
        </div>
        <div className="flex-1 overflow-y-auto scrollbar-thin px-2 py-2">
          {([{ code: 'vi' as const, label: t('vietnamese'), flag: '🇻🇳' }, { code: 'en' as const, label: t('english'), flag: '🇬🇧' }]).map(item => (
            <button
              key={item.code}
              onClick={() => { setLang(item.code); setShowLanguage(false); }}
              className={`flex items-center gap-3 w-full px-4 py-3 rounded-xl transition-colors text-left ${lang === item.code ? 'bg-primary/10 text-primary' : 'hover:bg-tg-hover'}`}
            >
              <span className="text-xl">{item.flag}</span>
              <span className="text-sm font-medium">{item.label}</span>
              {lang === item.code && <span className="ml-auto text-primary text-sm">✓</span>}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // Blocked users sub-view
  if (showBlocked) {
    return (
      <div className="flex flex-col h-full bg-tg-sidebar">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
          <button onClick={() => setShowBlocked(false)} className="p-2 rounded-lg hover:bg-tg-hover transition-colors">
            <ArrowLeft className="h-5 w-5 text-muted-foreground" />
          </button>
          <h2 className="font-display font-semibold text-lg">{t('blockedUsers')}</h2>
        </div>
        <div className="flex-1 overflow-y-auto scrollbar-thin px-2 py-2">
          {blockedUsers.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12">{t('noBlockedUsers')}</p>
          ) : (
            <div className="space-y-1">
              {blockedUsers.map(uid => {
                const bp = profiles[uid];
                if (!bp) return null;
                return (
                  <div key={uid} className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-tg-hover transition-colors">
                    <ChatAvatar name={bp.display_name} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{bp.display_name}</p>
                      <p className="text-xs text-muted-foreground">@{bp.username}</p>
                    </div>
                    <button
                      onClick={() => unblockUser(uid)}
                      className="px-2.5 py-1 rounded-lg bg-primary text-primary-foreground text-[11px] font-medium hover:bg-primary/90 transition-colors"
                    >
                      {t('unblock')}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Main settings list
  const items: { icon?: any; customIcon?: () => React.ReactNode; label: string; subtitle?: string; onClick: () => void; chevron?: boolean }[] = [
    { icon: Globe, label: t('language'), subtitle: lang === 'vi' ? '🇻🇳 Tiếng Việt' : '🇬🇧 English', onClick: () => setShowLanguage(true), chevron: true },
    { icon: Globe, label: t('language'), subtitle: lang === 'vi' ? '🇻🇳 Tiếng Việt' : '🇬🇧 English', onClick: () => setShowLanguage(true), chevron: true },
    { icon: KeyRound, label: t('changePassword'), onClick: () => setShowChangePassword(true) },
    { icon: Ban, label: `${t('blockedUsers')} (${blockedUsers.length})`, onClick: () => setShowBlocked(true), chevron: true },
    { icon: darkMode ? Sun : Moon, label: darkMode ? t('lightMode') : t('darkMode'), onClick: toggleDarkMode },
  ];

  return (
    <div className="flex flex-col h-full bg-tg-sidebar">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
        {onBack && (
          <button onClick={onBack} className="p-2 rounded-lg hover:bg-tg-hover transition-colors">
            <ArrowLeft className="h-5 w-5 text-muted-foreground" />
          </button>
        )}
        <h2 className="font-display font-semibold text-lg">{t('settings')}</h2>
      </div>
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        <div className="px-2 space-y-1">
          {items.map((item, i) => {
            const Icon = item.icon;
            return (
              <button
                key={i}
                onClick={item.onClick}
                className="flex items-center gap-3 w-full px-4 py-3 rounded-xl hover:bg-tg-hover transition-colors text-left"
              >
                {item.customIcon ? item.customIcon() : Icon ? <Icon className="h-5 w-5 text-primary" /> : null}
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium block">{item.label}</span>
                  {item.subtitle && (
                    <span className="text-xs text-muted-foreground">{item.subtitle}</span>
                  )}
                </div>
                {item.chevron && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
              </button>
            );
          })}
          <div className="border-t border-border my-2" />
          <button
            onClick={signOut}
            className="flex items-center gap-3 w-full px-4 py-3 rounded-xl hover:bg-destructive/10 transition-colors text-left"
          >
            <LogOut className="h-5 w-5 text-destructive" />
            <span className="text-sm font-medium text-destructive">{t('signOut')}</span>
          </button>
        </div>
      </div>
      {showChangePassword && <ChangePasswordDialog onClose={() => setShowChangePassword(false)} />}
    </div>
  );
};

export default SettingsView;
