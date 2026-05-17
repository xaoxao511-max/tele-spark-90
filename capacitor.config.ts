import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.chimcugay',
  appName: 'Chim Cu Gáy',
  webDir: 'dist',
  server: {
    url: 'https://953aa39a-7a46-46d0-99c9-c7ced87245a2.lovableproject.com?forceHideBadge=true',
    cleartext: true,
  },
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
