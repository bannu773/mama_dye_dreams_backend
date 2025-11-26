import { SESClient, SendEmailCommand, SendTemplatedEmailCommand } from "@aws-sdk/client-ses";

export const sesClient = new SESClient({
  region: process.env.SES_REGION || process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const FROM_EMAIL = process.env.SES_FROM_EMAIL!;

/**
 * Send a simple email
 * @param to Recipient email address
 * @param subject Email subject
 * @param htmlBody HTML content
 * @param textBody Plain text content (optional)
 */
export const sendEmail = async (
  to: string | string[],
  subject: string,
  htmlBody: string,
  textBody?: string
): Promise<void> => {
  try {
    const toAddresses = Array.isArray(to) ? to : [to];

    const command = new SendEmailCommand({
      Source: FROM_EMAIL,
      Destination: {
        ToAddresses: toAddresses,
      },
      Message: {
        Subject: {
          Data: subject,
          Charset: 'UTF-8',
        },
        Body: {
          Html: {
            Data: htmlBody,
            Charset: 'UTF-8',
          },
          ...(textBody && {
            Text: {
              Data: textBody,
              Charset: 'UTF-8',
            },
          }),
        },
      },
    });

    await sesClient.send(command);
    console.log(`✅ Email sent to ${toAddresses.join(', ')}`);
  } catch (error) {
    console.error('Error sending email:', error);
    throw new Error('Failed to send email');
  }
};

/**
 * Send templated email (if you create templates in AWS SES)
 * @param to Recipient email
 * @param templateName Name of the SES template
 * @param templateData Data to populate the template
 */
export const sendTemplatedEmail = async (
  to: string,
  templateName: string,
  templateData: Record<string, any>
): Promise<void> => {
  try {
    const command = new SendTemplatedEmailCommand({
      Source: FROM_EMAIL,
      Destination: {
        ToAddresses: [to],
      },
      Template: templateName,
      TemplateData: JSON.stringify(templateData),
    });

    await sesClient.send(command);
    console.log(`✅ Templated email sent to ${to}`);
  } catch (error) {
    console.error('Error sending templated email:', error);
    throw new Error('Failed to send templated email');
  }
};

/**
 * Send email with CC and BCC
 */
export const sendEmailWithCopies = async (
  to: string[],
  subject: string,
  htmlBody: string,
  cc?: string[],
  bcc?: string[]
): Promise<void> => {
  try {
    const command = new SendEmailCommand({
      Source: FROM_EMAIL,
      Destination: {
        ToAddresses: to,
        ...(cc && { CcAddresses: cc }),
        ...(bcc && { BccAddresses: bcc }),
      },
      Message: {
        Subject: { Data: subject, Charset: 'UTF-8' },
        Body: {
          Html: { Data: htmlBody, Charset: 'UTF-8' },
        },
      },
    });

    await sesClient.send(command);
    console.log(`✅ Email sent with copies`);
  } catch (error) {
    console.error('Error sending email with copies:', error);
    throw new Error('Failed to send email');
  }
};
