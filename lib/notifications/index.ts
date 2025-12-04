/**
 * Notification System - Main Export
 */

export { getNotificationService, NotificationService } from "./service"
export type { NotificationOptions, NotificationResult, ChannelResult } from "./service"
export { getEmailTemplate, emailTemplates } from "./templates/email"
export type { EmailTemplate, EmailTemplateData } from "./templates/email"

