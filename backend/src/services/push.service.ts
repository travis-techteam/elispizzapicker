import webpush, { PushSubscription } from 'web-push';
import { config } from '../config/index.js';
import prisma from '../utils/prisma.js';
import logger from '../utils/logger.js';

// Initialize web-push with VAPID keys
const vapidPublicKey = process.env.VAPID_PUBLIC_KEY || '';
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || '';

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(
    `mailto:${process.env.VAPID_CONTACT_EMAIL || 'admin@example.com'}`,
    vapidPublicKey,
    vapidPrivateKey
  );
  logger.info('Web Push VAPID details configured');
} else {
  logger.warn('VAPID keys not configured - push notifications disabled');
}

export function getVapidPublicKey(): string {
  return vapidPublicKey;
}

export function isPushEnabled(): boolean {
  return !!(vapidPublicKey && vapidPrivateKey);
}

export interface NotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: Record<string, unknown>;
  actions?: Array<{
    action: string;
    title: string;
    icon?: string;
  }>;
}

export async function saveSubscription(
  userId: string,
  subscription: PushSubscription
): Promise<void> {
  await prisma.pushSubscription.upsert({
    where: { userId },
    update: {
      subscription: subscription as unknown as Record<string, unknown>,
      updatedAt: new Date(),
    },
    create: {
      userId,
      subscription: subscription as unknown as Record<string, unknown>,
    },
  });
  logger.info({ userId }, 'Push subscription saved');
}

export async function deleteSubscription(userId: string): Promise<void> {
  await prisma.pushSubscription.delete({
    where: { userId },
  }).catch(() => {
    // Ignore if subscription doesn't exist
  });
  logger.info({ userId }, 'Push subscription deleted');
}

export async function getSubscription(userId: string): Promise<PushSubscription | null> {
  const record = await prisma.pushSubscription.findUnique({
    where: { userId },
  });
  return record?.subscription as unknown as PushSubscription | null;
}

export async function sendNotification(
  userId: string,
  payload: NotificationPayload
): Promise<boolean> {
  if (!isPushEnabled()) {
    logger.debug({ userId }, 'Push disabled, skipping notification');
    return false;
  }

  const record = await prisma.pushSubscription.findUnique({
    where: { userId },
  });

  if (!record) {
    logger.debug({ userId }, 'No push subscription found');
    return false;
  }

  const subscription = record.subscription as unknown as PushSubscription;

  try {
    await webpush.sendNotification(subscription, JSON.stringify(payload));
    logger.info({ userId }, 'Push notification sent');
    return true;
  } catch (error: unknown) {
    const pushError = error as { statusCode?: number };
    if (pushError.statusCode === 410 || pushError.statusCode === 404) {
      // Subscription expired or invalid - remove it
      await deleteSubscription(userId);
      logger.info({ userId }, 'Push subscription removed (expired/invalid)');
    } else {
      logger.error({ err: error, userId }, 'Failed to send push notification');
    }
    return false;
  }
}

export async function sendNotificationToAll(
  payload: NotificationPayload
): Promise<{ sent: number; failed: number }> {
  if (!isPushEnabled()) {
    return { sent: 0, failed: 0 };
  }

  const subscriptions = await prisma.pushSubscription.findMany();
  let sent = 0;
  let failed = 0;

  for (const record of subscriptions) {
    const success = await sendNotification(record.userId, payload);
    if (success) {
      sent++;
    } else {
      failed++;
    }
  }

  logger.info({ sent, failed }, 'Batch push notifications complete');
  return { sent, failed };
}

export async function sendNotificationToUsers(
  userIds: string[],
  payload: NotificationPayload
): Promise<{ sent: number; failed: number }> {
  if (!isPushEnabled()) {
    return { sent: 0, failed: 0 };
  }

  let sent = 0;
  let failed = 0;

  for (const userId of userIds) {
    const success = await sendNotification(userId, payload);
    if (success) {
      sent++;
    } else {
      failed++;
    }
  }

  return { sent, failed };
}
