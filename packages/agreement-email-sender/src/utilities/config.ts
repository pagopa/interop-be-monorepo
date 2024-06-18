import { z } from "zod";

export const AgreementEmailSenderConfig = z
  .object({
    AGREEMENT_EMAIL_SENDER: z.string().email(),
  })
  .transform((c) => ({
    agreementEmailSender: c.AGREEMENT_EMAIL_SENDER,
  }));

export type AgreementEmailSenderConfig = z.infer<
  typeof AgreementEmailSenderConfig
>;

export const agreementEmailSenderConfig: () => AgreementEmailSenderConfig =
  () => AgreementEmailSenderConfig.parse(process.env);
