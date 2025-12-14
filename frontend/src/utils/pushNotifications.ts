import { api } from '../services/api';

export async function isPushSupported(): Promise<boolean> {
  return 'serviceWorker' in navigator && 'PushManager' in window;
}

export async function getPermissionStatus(): Promise<NotificationPermission> {
  if (!('Notification' in window)) {
    return 'denied';
  }
  return Notification.permission;
}

export async function requestPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) {
    return 'denied';
  }
  return Notification.requestPermission();
}

export async function subscribeToPush(): Promise<boolean> {
  try {
    // Check if supported
    if (!(await isPushSupported())) {
      console.warn('Push notifications not supported');
      return false;
    }

    // Get permission
    const permission = await requestPermission();
    if (permission !== 'granted') {
      console.warn('Push notification permission denied');
      return false;
    }

    // Get VAPID public key from server
    const vapidResponse = await api.getVapidPublicKey();
    if (!vapidResponse.success || !vapidResponse.data?.publicKey) {
      console.error('Failed to get VAPID public key');
      return false;
    }

    // Get service worker registration
    const registration = await navigator.serviceWorker.ready;

    // Subscribe to push
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidResponse.data.publicKey),
    });

    // Send subscription to server
    const response = await api.subscribeToPush(subscription.toJSON() as PushSubscriptionJSON);
    return response.success;
  } catch (error) {
    console.error('Failed to subscribe to push:', error);
    return false;
  }
}

export async function unsubscribeFromPush(): Promise<boolean> {
  try {
    // Get service worker registration
    const registration = await navigator.serviceWorker.ready;

    // Get current subscription
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      await subscription.unsubscribe();
    }

    // Remove from server
    const response = await api.unsubscribeFromPush();
    return response.success;
  } catch (error) {
    console.error('Failed to unsubscribe from push:', error);
    return false;
  }
}

export async function isSubscribed(): Promise<boolean> {
  try {
    if (!(await isPushSupported())) {
      return false;
    }

    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    return !!subscription;
  } catch {
    return false;
  }
}

// Convert VAPID key from base64 to Uint8Array
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Type for subscription JSON
interface PushSubscriptionJSON {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  expirationTime?: number | null;
}
