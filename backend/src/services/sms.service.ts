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

  async sendVerificationCode(phoneNumber: string, code: string): Promise<SendSmsResult> {
    if (!this.apiUrl || !this.apiKey) {
      console.warn('Netsapiens API not configured, SMS not sent');
      return { success: false, error: 'SMS service not configured' };
    }

    try {
      // Format the message
      const message = `Your Eli's Pizza Picker verification code is: ${code}. This code expires in 10 minutes.`;

      // Netsapiens API call
      // Endpoint: /domains/{domain}/users/{user}/messages
      const response = await fetch(
        `${this.apiUrl}/domains/${this.domain}/users/${this.user}/messages`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            destination: phoneNumber,
            message: message,
            from: this.fromNumber,
            type: 'sms',
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

      const response = await fetch(
        `${this.apiUrl}/domains/${this.domain}/users/${this.user}/messages`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            destination: phoneNumber,
            message: message,
            from: this.fromNumber,
            type: 'sms',
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
