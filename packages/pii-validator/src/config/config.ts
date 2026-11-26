import {
  ApplicationAuditProducerConfig,
  CommonHTTPServiceConfig,
} from "pagopa-interop-commons";
import { z } from "zod";

const PiiValidatorConfig = CommonHTTPServiceConfig.and(
  ApplicationAuditProducerConfig
);

type PiiValidatorConfig = z.infer<typeof PiiValidatorConfig>;

export const config: PiiValidatorConfig = PiiValidatorConfig.parse(process.env);
