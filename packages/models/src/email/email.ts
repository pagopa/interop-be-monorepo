import { z } from "zod";

export const Email = z.object({
  subject: z.string(),
  body: z.string(),
});
export type Email = z.infer<typeof Email>;

export const EmailAddress = z.string().email();
export type EmailAddress = z.infer<typeof EmailAddress>;

export const InternetAddress = z.object({
  address: EmailAddress,
  personal: z.string(),
  encodedPersonal: z.string(),
});
export type InternetAddress = z.infer<typeof InternetAddress>;

export type MailAttachment = {
  name: string;
  bytes: Uint8Array;
  mimeType: string;
};
export const MailAttachment = z.custom<MailAttachment>();

export const TextMail = z.object({
  id: z.string().uuid(),
  recipients: z.array(InternetAddress),
  subject: z.string(),
  body: z.string(),
  attachments: z.array(MailAttachment),
});

export type TextMail = z.infer<typeof TextMail>;
