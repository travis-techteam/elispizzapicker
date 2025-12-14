import { reminderService } from './reminder.service.js';
import logger from '../utils/logger.js';

export class SchedulerService {
  private intervalId: NodeJS.Timeout | null = null;
  private readonly INTERVAL_MS = 60 * 1000; // Check every 60 seconds

  start(): void {
    if (this.intervalId) {
      logger.warn('Scheduler already running');
      return;
    }

    logger.info({ intervalMs: this.INTERVAL_MS }, 'Starting reminder scheduler');

    // Run immediately on start to catch any missed reminders
    this.tick();

    // Then run on interval
    this.intervalId = setInterval(() => this.tick(), this.INTERVAL_MS);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      logger.info('Scheduler stopped');
    }
  }

  private async tick(): Promise<void> {
    try {
      await reminderService.processReminders();
    } catch (error) {
      logger.error({ err: error }, 'Scheduler tick error');
    }
  }
}

export const schedulerService = new SchedulerService();
