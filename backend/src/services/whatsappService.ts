import prisma from '../prisma/client';

export interface WhatsAppConfig {
  enabled: boolean;
  provider: 'twilio' | 'meta' | 'custom';
  sendReference: boolean;
  sendPin: boolean;
  apiKey?: string;
  phoneNumberId?: string;
}

/**
 * Clean provider abstraction for WhatsApp messaging.
 * Currently disabled by default. Requires external configuration per organization.
 */
export const sendComplaintReceipt = async (
  organizationId: number,
  phone: string,
  referenceCode: string,
  trackingPin: string
): Promise<void> => {
  try {
    if (!phone) return;

    // 1. Fetch organization settings
    const org = await prisma.organizations.findUnique({
      where: { id: organizationId },
      select: { notification_settings: true },
    });

    if (!org || !org.notification_settings) return;

    const settings = org.notification_settings as Record<string, any>;
    const whatsappConfig = settings.whatsapp as WhatsAppConfig | undefined;

    // 2. Check if enabled
    if (!whatsappConfig || !whatsappConfig.enabled) {
      // Disabled by default
      return;
    }

    // 3. Prepare message
    let message = 'تم استلام طلبكم بنجاح.\n';
    if (whatsappConfig.sendReference) {
      message += `رقم المرجع: ${referenceCode}\n`;
    }
    if (whatsappConfig.sendPin) {
      message += `رمز التتبع: ${trackingPin}\n`;
    }

    // 4. Send via provider
    switch (whatsappConfig.provider) {
      case 'meta':
        // TODO: Implement Meta WhatsApp Cloud API integration
        // await metaClient.messages.create({ ... })
        console.log(`[WhatsApp:Meta] Queued receipt for ${phone}: ${referenceCode}`);
        break;
      case 'twilio':
        // TODO: Implement Twilio WhatsApp integration
        // await twilioClient.messages.create({ ... })
        console.log(`[WhatsApp:Twilio] Queued receipt for ${phone}: ${referenceCode}`);
        break;
      default:
        console.log(`[WhatsApp:Custom] Queued receipt for ${phone}: ${referenceCode}`);
    }

    // 5. Update notification/audit logs if needed
    // In the future, we can insert a record into a `delivery_outbox` table here
  } catch (error) {
    // WhatsApp failure MUST NOT fail the complaint creation process
    console.error(`[WhatsApp] Failed to send receipt to ${phone}:`, error);
  }
};
