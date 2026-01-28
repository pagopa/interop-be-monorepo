import {
  AWSConfig,
  FileManagerConfig,
  LoggerConfig,
} from "pagopa-interop-commons";
import { z } from "zod";

const OnetrustServiceConfig = FileManagerConfig.and(LoggerConfig)
  .and(AWSConfig)
  .and(
    z
      .object({
        LANGS: z.string().transform((value) => value.split(",")),
        CONTENT_STORAGE_BUCKET: z.string(),
        HISTORY_STORAGE_BUCKET: z.string(),
        ONETRUST_CLIENT_ID: z.string(),
        ONETRUST_CLIENT_SECRET: z.string(),
        PRIVACY_NOTICES_UPDATER_TERMS_OF_SERVICE_UUID: z.string(),
        PRIVACY_NOTICES_UPDATER_PRIVACY_POLICY_UUID: z.string(),
        PRIVACY_NOTICES_DYNAMO_TABLE_NAME: z.string(),
      })
      .transform((c) => ({
        langs: c.LANGS,
        contentStorageBucket: c.CONTENT_STORAGE_BUCKET,
        historyStorageBucket: c.HISTORY_STORAGE_BUCKET,
        onetrustClientId: c.ONETRUST_CLIENT_ID,
        onetrustClientSecret: c.ONETRUST_CLIENT_SECRET,
        privacyNoticesUpdaterTermsOfServiceUuid:
          c.PRIVACY_NOTICES_UPDATER_TERMS_OF_SERVICE_UUID,
        privacyNoticesUpdaterPrivacyPolicyUuid:
          c.PRIVACY_NOTICES_UPDATER_PRIVACY_POLICY_UUID,
        privacyNoticesDynamoTableName: c.PRIVACY_NOTICES_DYNAMO_TABLE_NAME,
      }))
  );

type OnetrustServiceConfig = z.infer<typeof OnetrustServiceConfig>;

export const config: OnetrustServiceConfig = OnetrustServiceConfig.parse(
  process.env
);
