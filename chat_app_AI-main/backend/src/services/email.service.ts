/**
 * EMAIL SERVICE
 * =============
 * Sends email notifications using Resend
 * Free tier: 100 emails/day, 3,000/month
 * Get API key: https://resend.com/api-keys
 */

import { logger } from '../utils/logger';

const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const FROM_EMAIL = process.env.FROM_EMAIL || 'notifications@yourdomain.com';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

interface SendEmailOptions {
  to: string;
  userName: string;
  title: string;
  body: string;
  actionUrl?: string;
}

export class EmailService {
  private isConfigured: boolean = false;

  constructor() {
    if (!RESEND_API_KEY) {
      logger.warn('⚠️ RESEND_API_KEY not set - Email notifications will be disabled');
    } else {
      this.isConfigured = true;
      logger.info('✅ Email service configured (Resend)');
    }
  }

  /**
   * Send notification email
   */
  async sendNotificationEmail(options: SendEmailOptions): Promise<boolean> {
    if (!this.isConfigured) {
      logger.warn('Email service not configured, skipping email');
      return false;
    }

    try {
      const actionButton = options.actionUrl
        ? `<a href="${APP_URL}${options.actionUrl}" style="display: inline-block; padding: 12px 24px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0;">View Message</a>`
        : '';

      const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${options.title}</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f3f4f6;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background-color: white; border-radius: 8px; padding: 30px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
      <h1 style="color: #1f2937; font-size: 24px; margin-bottom: 20px;">${options.title}</h1>
      <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
        Hi ${options.userName},
      </p>
      <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
        ${options.body}
      </p>
      ${actionButton}
      <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
        <p style="color: #9ca3af; font-size: 14px; margin: 0;">
          You're receiving this because you have notifications enabled for your chat app account.
        </p>
      </div>
    </div>
  </div>
</body>
</html>
`;

      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: FROM_EMAIL,
          to: options.to,
          subject: options.title,
          html: htmlContent,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Resend API error: ${error}`);
      }

      logger.info(`✅ Email sent to ${options.to}`);
      return true;
    } catch (error) {
      logger.error('Failed to send email:', error);
      return false;
    }
  }

  /**
   * Send new message notification email
   */
  async sendNewMessageEmail(
    to: string,
    userName: string,
    senderName: string,
    messagePreview: string,
    conversationId: string
  ): Promise<boolean> {
    return this.sendNotificationEmail({
      to,
      userName,
      title: `New message from ${senderName}`,
      body: `${senderName} sent you a message: "${messagePreview.substring(0, 100)}..."`,
      actionUrl: `/chat?conversation=${conversationId}`,
    });
  }
}

export const emailService = new EmailService();
