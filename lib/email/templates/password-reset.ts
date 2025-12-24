export function getPasswordResetEmailTemplate(resetUrl: string, userName?: string): { subject: string; html: string; text: string } {
  const subject = 'Reset Your tsmartWarehouse Password'
  
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Your Password</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f5f5f5; padding: 20px;">
    <tr>
      <td align="center" style="padding: 20px 0;">
        <table role="presentation" style="width: 100%; max-width: 600px; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 8px 8px 0 0;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 600;">Reset Your Password</h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <p style="margin: 0 0 20px; color: #333333; font-size: 16px; line-height: 1.6;">
                Hello${userName ? ` ${userName}` : ''},
              </p>
              
              <p style="margin: 0 0 20px; color: #333333; font-size: 16px; line-height: 1.6;">
                We received a request to reset your password for your <strong>tsmartWarehouse</strong> account.
              </p>
              
              <p style="margin: 0 0 30px; color: #333333; font-size: 16px; line-height: 1.6;">
                Click the button below to reset your password. This link will expire in <strong>24 hours</strong>.
              </p>
              
              <!-- CTA Button -->
              <table role="presentation" style="width: 100%; margin: 30px 0;">
                <tr>
                  <td align="center">
                    <a href="${resetUrl}" style="display: inline-block; padding: 14px 32px; background-color: #2563eb; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px; text-align: center;">
                      Reset Password
                    </a>
                  </td>
                </tr>
              </table>
              
              <!-- Alternative Link -->
              <p style="margin: 30px 0 0; color: #666666; font-size: 14px; line-height: 1.6;">
                Or copy and paste this link into your browser:
              </p>
              <p style="margin: 10px 0 20px; padding: 12px; background-color: #f5f5f5; border-radius: 4px; word-break: break-all; color: #2563eb; font-size: 14px; line-height: 1.6;">
                ${resetUrl}
              </p>
              
              <!-- Security Notice -->
              <div style="margin: 30px 0; padding: 16px; background-color: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 4px;">
                <p style="margin: 0; color: #92400e; font-size: 14px; line-height: 1.6;">
                  <strong>Security Notice:</strong> If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.
                </p>
              </div>
              
              <p style="margin: 30px 0 0; color: #333333; font-size: 16px; line-height: 1.6;">
                Best regards,<br>
                <strong>The tsmartWarehouse Team</strong>
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 20px 40px; background-color: #f9fafb; border-radius: 0 0 8px 8px; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; color: #9ca3af; font-size: 12px; text-align: center; line-height: 1.6;">
                This is an automated message. Please do not reply to this email.<br>
                © ${new Date().getFullYear()} tsmartWarehouse. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim()

  const text = `
Reset Your tsmartWarehouse Password

Hello${userName ? ` ${userName}` : ''},

We received a request to reset your password for your tsmartWarehouse account.

Click the link below to reset your password. This link will expire in 24 hours.

${resetUrl}

Security Notice: If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.

Best regards,
The tsmartWarehouse Team

---
This is an automated message. Please do not reply to this email.
© ${new Date().getFullYear()} tsmartWarehouse. All rights reserved.
  `.trim()

  return { subject, html, text }
}

