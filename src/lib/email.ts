// Email service for sending invitations and notifications
// This is a basic implementation that can be extended with different email providers

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

interface InvitationEmailData {
  recipientEmail: string;
  recipientName?: string;
  inviterName: string;
  inviterEmail: string;
  groupName: string;
  inviteToken: string;
  acceptUrl: string;
}

interface NotificationEmailData {
  recipientEmail: string;
  recipientName?: string;
  subject: string;
  message: string;
  actionUrl?: string;
  actionText?: string;
}

// Basic email template for invitations
function generateInvitationEmailHTML(data: InvitationEmailData): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Group Invitation - Expense Splitter</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #f8f9fa; padding: 20px; border-radius: 8px; text-align: center; margin-bottom: 20px; }
        .content { background-color: white; padding: 30px; border: 1px solid #e1e5e9; border-radius: 8px; }
        .button { display: inline-block; background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
        .footer { text-align: center; color: #666; font-size: 14px; margin-top: 20px; }
        .invite-details { background-color: #f8f9fa; padding: 15px; border-radius: 6px; margin: 20px 0; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>🧾 Expense Splitter</h1>
        <p>You've been invited to join a group!</p>
      </div>
      
      <div class="content">
        <h2>Hi${data.recipientName ? ` ${data.recipientName}` : ''}!</h2>
        
        <p><strong>${data.inviterName}</strong> (${data.inviterEmail}) has invited you to join the group <strong>"${data.groupName}"</strong> on Expense Splitter.</p>
        
        <div class="invite-details">
          <h3>📋 Group Details</h3>
          <p><strong>Group Name:</strong> ${data.groupName}</p>
          <p><strong>Invited by:</strong> ${data.inviterName} (${data.inviterEmail})</p>
        </div>
        
        <p>Expense Splitter helps you track shared expenses and settle up with friends easily. Join this group to:</p>
        <ul>
          <li>📝 Add and track shared expenses</li>
          <li>💰 See who owes what to whom</li>
          <li>🎯 Get smart settlement suggestions</li>
          <li>📊 View detailed spending history</li>
        </ul>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${data.acceptUrl}" class="button">Accept Invitation</a>
        </div>
        
        <p><small>This invitation link will work for anyone with access to it. If you don't want to join this group, you can safely ignore this email.</small></p>
      </div>
      
      <div class="footer">
        <p>Expense Splitter - Making shared expenses simple</p>
        <p>This is an automated email. Please don't reply to this message.</p>
      </div>
    </body>
    </html>
  `;
}

// Basic email template for notifications
function generateNotificationEmailHTML(data: NotificationEmailData): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>${data.subject} - Expense Splitter</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #f8f9fa; padding: 20px; border-radius: 8px; text-align: center; margin-bottom: 20px; }
        .content { background-color: white; padding: 30px; border: 1px solid #e1e5e9; border-radius: 8px; }
        .button { display: inline-block; background-color: #28a745; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
        .footer { text-align: center; color: #666; font-size: 14px; margin-top: 20px; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>🧾 Expense Splitter</h1>
        <p>${data.subject}</p>
      </div>
      
      <div class="content">
        <h2>Hi${data.recipientName ? ` ${data.recipientName}` : ''}!</h2>
        
        <p>${data.message}</p>
        
        ${data.actionUrl && data.actionText ? `
        <div style="text-align: center; margin: 30px 0;">
          <a href="${data.actionUrl}" class="button">${data.actionText}</a>
        </div>
        ` : ''}
      </div>
      
      <div class="footer">
        <p>Expense Splitter - Making shared expenses simple</p>
        <p>This is an automated email. Please don't reply to this message.</p>
      </div>
    </body>
    </html>
  `;
}

// Mock email service (replace with real email provider)
class EmailService {
  private isEnabled: boolean;
  
  constructor() {
    // Check if email is configured (you can add more sophisticated checks)
    this.isEnabled = !!(
      process.env.EMAIL_PROVIDER || 
      process.env.SMTP_HOST ||
      process.env.SENDGRID_API_KEY
    );
  }

  async sendEmail(options: EmailOptions): Promise<boolean> {
    if (!this.isEnabled) {
      console.log('📧 Email service not configured. Email would be sent:');
      console.log(`To: ${options.to}`);
      console.log(`Subject: ${options.subject}`);
      console.log('HTML content length:', options.html.length);
      return true; // Return true for development
    }

    try {
      // Here you would integrate with your preferred email service
      // Examples: SendGrid, AWS SES, Nodemailer, etc.
      
      // For now, just log the email details
      console.log('📧 Sending email:', {
        to: options.to,
        subject: options.subject,
        htmlLength: options.html.length
      });
      
      // TODO: Implement actual email sending
      // Example with SendGrid:
      // const sgMail = require('@sendgrid/mail');
      // sgMail.setApiKey(process.env.SENDGRID_API_KEY);
      // await sgMail.send({
      //   to: options.to,
      //   from: process.env.FROM_EMAIL,
      //   subject: options.subject,
      //   html: options.html,
      //   text: options.text
      // });

      return true;
    } catch (error) {
      console.error('❌ Failed to send email:', error);
      return false;
    }
  }

  async sendInvitationEmail(data: InvitationEmailData): Promise<boolean> {
    const html = generateInvitationEmailHTML(data);
    const text = `Hi${data.recipientName ? ` ${data.recipientName}` : ''}!\n\n${data.inviterName} has invited you to join the group "${data.groupName}" on Expense Splitter.\n\nAccept the invitation: ${data.acceptUrl}\n\nExpense Splitter - Making shared expenses simple`;

    return this.sendEmail({
      to: data.recipientEmail,
      subject: `You're invited to join "${data.groupName}" on Expense Splitter`,
      html,
      text
    });
  }

  async sendNotificationEmail(data: NotificationEmailData): Promise<boolean> {
    const html = generateNotificationEmailHTML(data);
    const text = `Hi${data.recipientName ? ` ${data.recipientName}` : ''}!\n\n${data.message}\n\n${data.actionUrl && data.actionText ? `${data.actionText}: ${data.actionUrl}\n\n` : ''}Expense Splitter - Making shared expenses simple`;

    return this.sendEmail({
      to: data.recipientEmail,
      subject: data.subject,
      html,
      text
    });
  }

  isEmailEnabled(): boolean {
    return this.isEnabled;
  }
}

// Export singleton instance
export const emailService = new EmailService();

// Export types for use in other files
export type { InvitationEmailData, NotificationEmailData };