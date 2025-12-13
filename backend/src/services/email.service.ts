import { config } from '../config/index.js';

interface SendEmailResult {
  success: boolean;
  error?: string;
}

interface Smtp2GoResponse {
  data?: {
    succeeded: number;
    failed: number;
  };
  request_id?: string;
}

export class EmailService {
  private apiUrl = 'https://api.smtp2go.com/v3/email/send';

  private async sendEmail(
    to: string,
    subject: string,
    textBody: string,
    htmlBody: string
  ): Promise<SendEmailResult> {
    if (!config.smtp.apiKey) {
      console.warn('SMTP2GO API key not configured, email not sent');
      return { success: false, error: 'Email service not configured' };
    }

    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Smtp2go-Api-Key': config.smtp.apiKey,
        },
        body: JSON.stringify({
          sender: config.smtp.from,
          to: [to],
          subject: subject,
          text_body: textBody,
          html_body: htmlBody,
          track_clicks: false,  // Disable click tracking to preserve magic link URLs
        }),
      });

      const data: Smtp2GoResponse = await response.json();

      if (!response.ok || (data.data && data.data.failed > 0)) {
        console.error('SMTP2GO API error:', data);
        return { success: false, error: 'Failed to send email' };
      }

      return { success: true };
    } catch (error) {
      console.error('Email send error:', error);
      return { success: false, error: 'Failed to send email' };
    }
  }

  async sendMagicLink(email: string, token: string): Promise<SendEmailResult> {
    const magicLink = `${config.appUrl}/auth/verify?token=${token}`;

    const textBody = `
Click the link below to log in to Eli's Pizza Picker:

${magicLink}

This link expires in 10 minutes.

If you didn't request this login link, you can safely ignore this email.
    `.trim();

    const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 20px; background-color: #FFFBEB;">
  <div style="max-width: 480px; margin: 0 auto; background: white; border-radius: 12px; padding: 32px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
    <h1 style="color: #DC2626; margin: 0 0 24px 0; font-size: 24px;">Eli's Pizza Picker</h1>
    <p style="color: #1F2937; font-size: 16px; line-height: 1.5; margin: 0 0 24px 0;">
      Click the button below to log in:
    </p>
    <a href="${magicLink}" style="display: inline-block; background-color: #DC2626; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
      Log In
    </a>
    <p style="color: #6B7280; font-size: 14px; margin: 24px 0 0 0;">
      This link expires in 10 minutes.
    </p>
    <p style="color: #9CA3AF; font-size: 12px; margin: 16px 0 0 0;">
      If you didn't request this login link, you can safely ignore this email.
    </p>
  </div>
</body>
</html>
    `.trim();

    return this.sendEmail(
      email,
      "Your Login Link - Eli's Pizza Picker",
      textBody,
      htmlBody
    );
  }

  async sendInvite(email: string, inviterName: string): Promise<SendEmailResult> {
    const textBody = `
${inviterName} has invited you to Eli's Pizza Picker!

Visit ${config.appUrl} to vote on pizza for the next dinner.

See you there!
    `.trim();

    const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 20px; background-color: #FFFBEB;">
  <div style="max-width: 480px; margin: 0 auto; background: white; border-radius: 12px; padding: 32px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
    <h1 style="color: #DC2626; margin: 0 0 24px 0; font-size: 24px;">Eli's Pizza Picker</h1>
    <p style="color: #1F2937; font-size: 16px; line-height: 1.5; margin: 0 0 16px 0;">
      <strong>${inviterName}</strong> has invited you to join!
    </p>
    <p style="color: #1F2937; font-size: 16px; line-height: 1.5; margin: 0 0 24px 0;">
      Vote on pizza for the next dinner and help choose what to order.
    </p>
    <a href="${config.appUrl}" style="display: inline-block; background-color: #DC2626; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
      Get Started
    </a>
  </div>
</body>
</html>
    `.trim();

    return this.sendEmail(
      email,
      "You're Invited - Eli's Pizza Picker",
      textBody,
      htmlBody
    );
  }
}

export const emailService = new EmailService();
