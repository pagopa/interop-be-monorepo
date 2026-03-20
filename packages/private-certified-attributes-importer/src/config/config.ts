import {
  APIEndpoint,
  LoggerConfig,
  ReadModelSQLDbConfig,
  TokenGenerationConfig,
} from "pagopa-interop-commons";
import { z } from "zod";

const PrivateCertifiedAttributesImporterConfig = LoggerConfig.and(
  ReadModelSQLDbConfig
)
  .and(TokenGenerationConfig)
  .and(
    z
      .object({
        TENANT_PROCESS_URL: APIEndpoint,
        ATTRIBUTE_PROCESS_URL: APIEndpoint,
        ATTRIBUTE_CREATION_WAIT_TIME: z.coerce.number(),
      })
      .transform((c) => ({
        tenantProcessUrl: c.TENANT_PROCESS_URL,
        attributeProcessUrl: c.ATTRIBUTE_PROCESS_URL,
        attributeCreationWaitTime: c.ATTRIBUTE_CREATION_WAIT_TIME,
      }))
  );

export const config: PrivateCertifiedAttributesImporterConfig =
  PrivateCertifiedAttributesImporterConfig.parse(process.env);

export type PrivateCertifiedAttributesImporterConfig = z.infer<
  typeof PrivateCertifiedAttributesImporterConfig
>;
