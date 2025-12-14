import { config } from '../config/index.js';

interface SendSmsResult {
  success: boolean;
  error?: string;
}

export class SmsService {
  private apiUrl: string;
  private domain: string;
  private user: string;
  private apiKey: string;
  private fromNumber: string;

  constructor() {
    this.apiUrl = config.netsapiens.apiUrl;
    this.domain = config.netsapiens.domain;
    this.user = config.netsapiens.user;
    this.apiKey = config.netsapiens.apiKey;
    this.fromNumber = config.netsapiens.fromNumber;
  }

  private generateMessageSession(): string {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_';
    let result = '';
    for (let i = 0; i < 32; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  private formatPhoneNumber(phone: string): string {
    // Remove all non-digit characters to get format: 15551234567
    return phone.replace(/\D/g, '');
  }

  async sendVerificationCode(phoneNumber: string, code: string): Promise<SendSmsResult> {
    if (!this.apiUrl || !this.apiKey) {
      console.warn('Netsapiens API not configured, SMS not sent');
      return { success: false, error: 'SMS service not configured' };
    }

    try {
      const message = `Your Eli's Pizza Picker verification code is: ${code}. This code expires in 10 minutes.`;
      const messageSession = this.generateMessageSession();
      const formattedDestination = this.formatPhoneNumber(phoneNumber);
      const formattedFrom = this.formatPhoneNumber(this.fromNumber);

      const response = await fetch(
        `${this.apiUrl}/domains/${this.domain}/users/${this.user}/messagesessions/${messageSession}/messages`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            type: 'sms',
            message: message,
            destination: formattedDestination,
            'from-number': formattedFrom,
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Netsapiens SMS error:', errorText);
        return { success: false, error: 'Failed to send SMS' };
      }

      return { success: true };
    } catch (error) {
      console.error('SMS send error:', error);
      return { success: false, error: 'Failed to send SMS' };
    }
  }

  async sendInvite(phoneNumber: string, inviterName: string): Promise<SendSmsResult> {
    if (!this.apiUrl || !this.apiKey) {
      console.warn('Netsapiens API not configured, SMS not sent');
      return { success: false, error: 'SMS service not configured' };
    }

    try {
      const message = `${inviterName} has invited you to Eli's Pizza Picker! Visit ${config.appUrl} to vote on pizza for the next dinner.`;
      const messageSession = this.generateMessageSession();
      const formattedDestination = this.formatPhoneNumber(phoneNumber);
      const formattedFrom = this.formatPhoneNumber(this.fromNumber);

      const response = await fetch(
        `${this.apiUrl}/domains/${this.domain}/users/${this.user}/messagesessions/${messageSession}/messages`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            type: 'sms',
            message: message,
            destination: formattedDestination,
            'from-number': formattedFrom,
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Netsapiens SMS error:', errorText);
        return { success: false, error: 'Failed to send SMS' };
      }

      return { success: true };
    } catch (error) {
      console.error('SMS send error:', error);
      return { success: false, error: 'Failed to send SMS' };
    }
  }

  async sendMessage(phoneNumber: string, message: string): Promise<SendSmsResult> {
    if (!this.apiUrl || !this.apiKey) {
      console.warn('Netsapiens API not configured, SMS not sent');
      return { success: false, error: 'SMS service not configured' };
    }

    try {
      const messageSession = this.generateMessageSession();
      const formattedDestination = this.formatPhoneNumber(phoneNumber);
      const formattedFrom = this.formatPhoneNumber(this.fromNumber);

      const response = await fetch(
        `${this.apiUrl}/domains/${this.domain}/users/${this.user}/messagesessions/${messageSession}/messages`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            type: 'sms',
            message: message,
            destination: formattedDestination,
            'from-number': formattedFrom,
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Netsapiens SMS error:', errorText);
        return { success: false, error: 'Failed to send SMS' };
      }

      return { success: true };
    } catch (error) {
      console.error('SMS send error:', error);
      return { success: false, error: 'Failed to send SMS' };
    }
  }
}

export const smsService = new SmsService();
