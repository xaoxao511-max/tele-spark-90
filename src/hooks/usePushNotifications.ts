import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { LocalNotifications } from '@capacitor/local-notifications';
import { supabase } from '@/integrations/supabase/client';

/**
 * Đăng ký push notification trên native (iOS/Android).
 * - Xin quyền
 * - Nhận FCM/APNs token và lưu vào bảng device_tokens
 * - Khi app đang mở mà có push → hiển thị local notification
 */
export function usePushNotifications(userId: string | undefined) {
  useEffect(() => {
    if (!userId) return;
    if (!Capacitor.isNativePlatform()) return;

    let mounted = true;

    const register = async () => {
      try {
        // Xin quyền local notification (dùng khi app foreground)
        await LocalNotifications.requestPermissions();

        // Xin quyền push
        let perm = await PushNotifications.checkPermissions();
        if (perm.receive === 'prompt' || perm.receive === 'prompt-with-rationale') {
          perm = await PushNotifications.requestPermissions();
        }
        if (perm.receive !== 'granted') {
          console.warn('[Push] Permission denied');
          return;
        }

        await PushNotifications.register();
      } catch (e) {
        console.error('[Push] register error', e);
      }
    };

    const tokenListener = PushNotifications.addListener('registration', async (token) => {
      if (!mounted) return;
      const platform = Capacitor.getPlatform() as 'ios' | 'android';
      try {
        await supabase
          .from('device_tokens')
          .upsert(
            { user_id: userId, token: token.value, platform },
            { onConflict: 'user_id,token' }
          );
        console.log('[Push] Token saved');
      } catch (e) {
        console.error('[Push] Save token failed', e);
      }
    });

    const errorListener = PushNotifications.addListener('registrationError', (err) => {
      console.error('[Push] Registration error', err);
    });

    // App foreground → push tới: hiện local notification
    const receivedListener = PushNotifications.addListener('pushNotificationReceived', async (n) => {
      try {
        await LocalNotifications.schedule({
          notifications: [
            {
              id: Math.floor(Math.random() * 100000),
              title: n.title || 'Tin nhắn mới',
              body: n.body || '',
              extra: n.data,
            },
          ],
        });
      } catch (e) {
        console.error('[Push] Local notif error', e);
      }
    });

    register();

    return () => {
      mounted = false;
      tokenListener.then((l) => l.remove());
      errorListener.then((l) => l.remove());
      receivedListener.then((l) => l.remove());
    };
  }, [userId]);
}
