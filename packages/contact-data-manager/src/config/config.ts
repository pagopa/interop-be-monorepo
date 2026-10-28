import {
  ApplicationAuditProducerConfig,
  CommonHTTPServiceConfig,
  ContactDataDBConfig,
} from "pagopa-interop-commons";
import { z } from "zod";

const ContactDataManagerConfig = CommonHTTPServiceConfig.and(
  ApplicationAuditProducerConfig
).and(ContactDataDBConfig);

type ContactDataManagerConfig = z.infer<typeof ContactDataManagerConfig>;

export const config: ContactDataManagerConfig = ContactDataManagerConfig.parse(
  process.env
);
