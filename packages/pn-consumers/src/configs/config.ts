import {
  AWSSesConfig,
  LoggerConfig,
  ReadModelSQLDbConfig,
} from "pagopa-interop-commons";
import { z } from "zod";

const PnConsumersConfig = LoggerConfig.and(ReadModelSQLDbConfig)
  .and(AWSSesConfig)
  .and(
    z
      .object({
        MAIL_RECIPIENTS: z.string().transform((value) => value.split(",")),
        REPORT_SENDER_MAIL: z.string().email(),
        REPORT_SENDER_LABEL: z.string(),

        PN_ESERVICE_ID: z.string(),
        COMUNI_E_LORO_CONSORZI_E_ASSOCIAZIONI_ATTRIBUTE_ID: z.string(),
      })
      .transform((c) => ({
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
