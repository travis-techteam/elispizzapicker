import { reminderService } from './reminder.service.js';

export class SchedulerService {
  private intervalId: NodeJS.Timeout | null = null;
  private readonly INTERVAL_MS = 60 * 1000; // Check every 60 seconds

  start(): void {
    if (this.intervalId) {
      console.log('Scheduler already running');
      return;
    }

    console.log('Starting reminder scheduler (checking every 60 seconds)');

    // Run immediately on start to catch any missed reminders
    this.tick();

    // Then run on interval
    this.intervalId = setInterval(() => this.tick(), this.INTERVAL_MS);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('Scheduler stopped');
    }
  }

  private async tick(): Promise<void> {
    try {
      await reminderService.processReminders();
    } catch (error) {
      console.error('Scheduler tick error:', error);
    }
  }
}

export const schedulerService = new SchedulerService();
