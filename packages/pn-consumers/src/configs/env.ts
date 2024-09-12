import { LoggerConfig, ReadModelDbConfig } from "pagopa-interop-commons";
import { z } from "zod";

const PnConsumersConfig = LoggerConfig.and(ReadModelDbConfig).and(
  z
    .object({
      SMTP_ADDRESS: z.string(),
      SMTP_PORT: z.string().transform((value) => Number(value)),
      SMTP_USER: z.string(),
      SMTP_PASSWORD: z.string(),
      SMTP_SECURE: z.string().transform((value) => value === "true"),
      MAIL_RECIPIENTS: z.string().transform((value) => value.split(",")),
      REPORT_SENDER_MAIL: z.string().email(),
      REPORT_SENDER_LABEL: z.string(),

      PN_ESERVICE_ID: z.string(),
      COMUNI_E_LORO_CONSORZI_E_ASSOCIAZIONI_ATTRIBUTE_ID: z.string(),
    })
    .transform((c) => ({
      smtpAddress: c.SMTP_ADDRESS,
      smtpPort: c.SMTP_PORT,
      smtpUser: c.SMTP_USER,
      smtpPassword: c.SMTP_PASSWORD,
      smtpSecure: c.SMTP_SECURE,
      mailRecipients: c.MAIL_RECIPIENTS,
      reportSenderMail: c.REPORT_SENDER_MAIL,
      reportSenderLabel: c.REPORT_SENDER_LABEL,
      pnEserviceId: c.PN_ESERVICE_ID,
      comuniELoroConsorziEAssociazioniAttributeId:
        c.COMUNI_E_LORO_CONSORZI_E_ASSOCIAZIONI_ATTRIBUTE_ID,
    }))
);

export type PnConsumersConfig = z.infer<typeof PnConsumersConfig>;

export const config: PnConsumersConfig = PnConsumersConfig.parse(process.env);
// export const Env = z.object({
//
//   MONGODB_REPLICA_SET: z.string().optional(),
//   MONGODB_READ_PREFERENCE: z.string(),
//   MONGODB_DIRECT_CONNECTION: z
//     .string()
//     .transform((value) => value === "true")
//     .optional(),
//   MONGODB_RETRY_WRITES: z
//     .string()
//     .transform((value) => value === "true")
//     .optional(),
// });
