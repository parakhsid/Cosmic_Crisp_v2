import {appendDispatchedAlert} from './offlineDb';
import type {DispatchedAlertLog} from '../types/agronomy';

export type PushPermissionState = 'granted' | 'denied' | 'default' | 'unsupported';

export function getNotificationPermission(): PushPermissionState {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission;
}

export async function requestPushPermission(): Promise<PushPermissionState> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  const result = await Notification.requestPermission();
  return result;
}

export async function dispatchCropPushNotification(params: {
  title: string;
  body: string;
  severity: 'critical' | 'warning';
}): Promise<{deliveredVia: 'service_worker' | 'window_notification' | 'in_app_only'; log: DispatchedAlertLog}> {
  const log: DispatchedAlertLog = {
    id: `alert-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    title: params.title,
    body: params.body,
    severity: params.severity,
    sentAt: new Date().toISOString(),
  };

  await appendDispatchedAlert(log);

  if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
    try {
      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.ready;
        if (reg && typeof reg.showNotification === 'function') {
          await reg.showNotification(params.title, {
            body: params.body,
            icon: '/pwa-192x192.png',
            badge: '/pwa-192x192.png',
            tag: `cosmic-crisp-${params.severity}`,
            requireInteraction: params.severity === 'critical',
          });
          return {deliveredVia: 'service_worker', log};
        }
      }
      new Notification(params.title, {
        body: params.body,
        icon: '/pwa-192x192.png',
      });
      return {deliveredVia: 'window_notification', log};
    } catch {
      return {deliveredVia: 'in_app_only', log};
    }
  }

  return {deliveredVia: 'in_app_only', log};
}
