import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { LocalNotifications } from '@capacitor/local-notifications';

/**
 * Xin tất cả quyền cần thiết khi app khởi động trên native (Android/iOS).
 * - Quyền thông báo (push + local) — bắt buộc cho Android 13+
 * - Quyền camera & microphone — cho voice/video call
 *
 * Các quyền runtime khác (READ_MEDIA_*, RECORD_AUDIO, CAMERA) sẽ được hệ
 * điều hành tự popup khi user thao tác tính năng cần đến (chọn ảnh, gọi…).
 * Khai báo trong AndroidManifest.xml mới quan trọng nhất.
 */
export function useAppPermissions() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    (async () => {
      try {
        // Local notifications (Android 13+ POST_NOTIFICATIONS)
        const localPerm = await LocalNotifications.checkPermissions();
        if (localPerm.display !== 'granted') {
          await LocalNotifications.requestPermissions();
        }

        // Push notifications
        const pushPerm = await PushNotifications.checkPermissions();
        if (pushPerm.receive === 'prompt' || pushPerm.receive === 'prompt-with-rationale') {
          await PushNotifications.requestPermissions();
        }

        // Camera & Microphone: yêu cầu qua getUserMedia để OS popup quyền sớm
        // (chỉ làm 1 lần đầu — sau đó OS nhớ luôn)
        try {
          const alreadyAsked = localStorage.getItem('media-perm-asked');
          if (!alreadyAsked && navigator.mediaDevices?.getUserMedia) {
            const stream = await navigator.mediaDevices.getUserMedia({
              audio: true,
              video: true,
            });
            stream.getTracks().forEach((t) => t.stop());
            localStorage.setItem('media-perm-asked', '1');
          }
        } catch {
          // user từ chối — không sao, sẽ hỏi lại khi gọi
        }
      } catch (e) {
        console.warn('[Permissions] init error', e);
      }
    })();
  }, []);
}
