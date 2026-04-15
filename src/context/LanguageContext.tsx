import React, { createContext, useContext, useState, useEffect } from 'react';

type Lang = 'vi' | 'en';

const translations = {
  vi: {
    settings: 'Cài đặt',
    contacts: 'Danh bạ',
    profile: 'Hồ sơ',
    editProfile: 'Chỉnh sửa Profile',
    savedMessages: 'Saved Messages',
    botManagement: 'Bot Management',
    botFather: '🤖 BotFather',
    approveEmails: 'Duyệt email đăng ký',
    adminDashboard: 'Admin Dashboard',
    darkMode: 'Chế độ tối',
    lightMode: 'Chế độ sáng',
    signOut: 'Đăng xuất',
    language: 'Ngôn ngữ',
    changePassword: 'Đổi mật khẩu',
    blockedUsers: 'Người dùng đã chặn',
    newChat: 'Cuộc trò chuyện mới',
    search: 'Tìm kiếm (Enter)...',
    noConversations: 'Chưa có cuộc trò chuyện',
    notFound: 'Không tìm thấy',
    noMessages: 'Chưa có tin nhắn',
    friends: 'Bạn bè',
    requests: 'Lời mời',
    findUsers: 'Tìm người dùng',
    noFriends: 'Chưa có bạn bè',
    noRequests: 'Không có lời mời',
    received: 'Đã nhận',
    sent: 'Đã gửi',
    addFriend: 'Kết bạn',
    accept: 'Chấp nhận',
    cancel: 'Huỷ',
    confirm: 'Xác nhận',
    unfriend: 'Huỷ kết bạn',
    block: 'Chặn',
    unblock: 'Bỏ chặn',
    noBlockedUsers: 'Chưa chặn ai',
    displayName: 'Tên hiển thị',
    username: 'Username',
    bio: 'Bio',
    phoneNumber: 'Số điện thoại',
    save: 'Lưu thay đổi',
    saving: 'Đang lưu...',
    newPassword: 'Mật khẩu mới',
    confirmPassword: 'Xác nhận mật khẩu',
    processing: 'Đang xử lý...',
    vietnamese: 'Tiếng Việt',
    english: 'English',
    back: 'Quay lại',
    chat: 'Chat',
    message: 'Nhắn tin',
    viewProfile: 'Xem profile',
    minChars: 'Nhập ít nhất 2 ký tự để tìm kiếm',
    users: 'Người dùng',
    aboutYou: 'Giới thiệu về bạn...',
  },
  en: {
    settings: 'Settings',
    contacts: 'Contacts',
    profile: 'Profile',
    editProfile: 'Edit Profile',
    savedMessages: 'Saved Messages',
    botManagement: 'Bot Management',
    botFather: '🤖 BotFather',
    approveEmails: 'Approve Registrations',
    adminDashboard: 'Admin Dashboard',
    darkMode: 'Dark Mode',
    lightMode: 'Light Mode',
    signOut: 'Sign Out',
    language: 'Language',
    changePassword: 'Change Password',
    blockedUsers: 'Blocked Users',
    newChat: 'New Conversation',
    search: 'Search (Enter)...',
    noConversations: 'No conversations yet',
    notFound: 'Not found',
    noMessages: 'No messages yet',
    friends: 'Friends',
    requests: 'Requests',
    findUsers: 'Find Users',
    noFriends: 'No friends yet',
    noRequests: 'No requests',
    received: 'Received',
    sent: 'Sent',
    addFriend: 'Add Friend',
    accept: 'Accept',
    cancel: 'Cancel',
    confirm: 'Confirm',
    unfriend: 'Unfriend',
    block: 'Block',
    unblock: 'Unblock',
    noBlockedUsers: 'No blocked users',
    displayName: 'Display Name',
    username: 'Username',
    bio: 'Bio',
    phoneNumber: 'Phone Number',
    save: 'Save Changes',
    saving: 'Saving...',
    newPassword: 'New Password',
    confirmPassword: 'Confirm Password',
    processing: 'Processing...',
    vietnamese: 'Tiếng Việt',
    english: 'English',
    back: 'Back',
    chat: 'Chat',
    message: 'Message',
    viewProfile: 'View Profile',
    minChars: 'Enter at least 2 characters to search',
    users: 'Users',
    aboutYou: 'About you...',
  },
} as const;

type TranslationKey = keyof typeof translations.vi;

interface LanguageContextType {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: TranslationKey) => string;
}

const LanguageContext = createContext<LanguageContextType>({
  lang: 'vi',
  setLang: () => {},
  t: (key) => key,
});

export const useLanguage = () => useContext(LanguageContext);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLangState] = useState<Lang>(() => {
    return (localStorage.getItem('app-language') as Lang) || 'vi';
  });

  const setLang = (l: Lang) => {
    setLangState(l);
    localStorage.setItem('app-language', l);
  };

  const t = (key: TranslationKey): string => {
    return translations[lang][key] || key;
  };

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
};
