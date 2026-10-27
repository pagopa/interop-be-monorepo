import {
  ApplicationAuditProducerConfig,
  CommonHTTPServiceConfig,
  PersonalDataDBConfig,
} from "pagopa-interop-commons";
import { z } from "zod";

const PersonalDataManagerConfig = CommonHTTPServiceConfig.and(
  ApplicationAuditProducerConfig
).and(PersonalDataDBConfig);

type PersonalDataManagerConfig = z.infer<typeof PersonalDataManagerConfig>;

export const config: PersonalDataManagerConfig =
  PersonalDataManagerConfig.parse(process.env);
