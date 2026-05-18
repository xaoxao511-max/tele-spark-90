import type { CapacitorConfig } from '@capacitor/cli';

// Bật hot-reload khi dev bằng cách set env: CAP_DEV=1 npx cap run android
// Khi build APK release thì KHÔNG set env này -> app sẽ load file dist/ đóng gói trong APK
const isDev = process.env.CAP_DEV === '1';

const config: CapacitorConfig = {
  appId: 'app.lovable.chimcugay',
  appName: 'Chim Cu Gáy',
  webDir: 'dist',
  ...(isDev && {
    server: {
      url: 'https://953aa39a-7a46-46d0-99c9-c7ced87245a2.lovableproject.com?forceHideBadge=true',
      cleartext: true,
    },
  }),
  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    SplashScreen: {
      launchShowDuration: 1500,
      backgroundColor: '#0F172A',
      showSpinner: false,
    },
  },
};

export default config;
