import prisma from '../utils/prisma.js';
import { smsService } from './sms.service.js';
import { config } from '../config/index.js';

export class ReminderService {
  /**
   * Check for events that need reminders sent and send them.
   * Called periodically by the scheduler.
   */
  async processReminders(): Promise<void> {
    const now = new Date();

    // Find active events that:
    // 1. Have a reminder configured
    // 2. Haven't had reminders sent yet
    // 3. The deadline hasn't passed yet
    const eventsNeedingReminders = await prisma.event.findMany({
      where: {
        reminderMinutesBefore: { not: null },
        reminderSentAt: null,
        deadline: { gt: now },
        isActive: true,
      },
    });

    for (const event of eventsNeedingReminders) {
      const reminderTime = new Date(
        event.deadline.getTime() - (event.reminderMinutesBefore! * 60 * 1000)
      );

      // Check if the reminder time has passed
      if (now >= reminderTime) {
        console.log(`Sending reminders for event: ${event.name}`);
        await this.sendRemindersForEvent(event.id, event.name, event.deadline);
      }
    }
  }

  /**
   * Send reminders to all users who haven't voted for the given event.
   */
  async sendRemindersForEvent(
    eventId: string,
    eventName: string,
    deadline: Date
  ): Promise<{ sent: number; failed: number }> {
    // Get all user IDs who have voted for this event
    const votes = await prisma.vote.findMany({
      where: { eventId },
      select: { userId: true },
    });
    const votedUserIds = votes.map((v) => v.userId);

    // Get users who haven't voted
    const usersToRemind = await prisma.user.findMany({
      where: {
        id: { notIn: votedUserIds.length > 0 ? votedUserIds : ['none'] },
      },
      select: { id: true, phone: true, name: true },
    });

    if (usersToRemind.length === 0) {
      console.log(`No users need reminders for event: ${eventName}`);
      // Still mark as sent so we don't keep checking
      await prisma.event.update({
        where: { id: eventId },
        data: { reminderSentAt: new Date() },
      });
      return { sent: 0, failed: 0 };
    }

    let sent = 0;
    let failed = 0;

    // Send reminders
    for (const user of usersToRemind) {
      try {
        const result = await this.sendReminderSms(
          user.phone,
          eventName,
          deadline
        );
        if (result) {
          sent++;
        } else {
          failed++;
        }
      } catch (error) {
        console.error(`Failed to send reminder to ${user.name}:`, error);
        failed++;
      }
    }

    // Mark reminders as sent
    await prisma.event.update({
      where: { id: eventId },
      data: { reminderSentAt: new Date() },
    });

    console.log(
      `Sent ${sent} reminders for event: ${eventName} (${failed} failed)`
    );
    return { sent, failed };
  }

  /**
   * Send a single reminder SMS.
   */
  private async sendReminderSms(
    phone: string,
    eventName: string,
    deadline: Date
  ): Promise<boolean> {
    const timeLeft = this.formatTimeUntil(deadline);
    const message = `Reminder: You haven't voted in "${eventName}" yet! Voting closes in ${timeLeft}. Visit ${config.appUrl} to cast your vote.`;

    const result = await smsService.sendMessage(phone, message);
    return result.success;
  }

  /**
   * Format the time remaining until a deadline in a human-readable way.
   */
  private formatTimeUntil(date: Date): string {
    const diff = date.getTime() - Date.now();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 0) {
      return `${hours} hour${hours > 1 ? 's' : ''}${minutes > 0 ? ` ${minutes} min` : ''}`;
    }
    return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
  }
}

export const reminderService = new ReminderService();
