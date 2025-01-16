import {
  APIEndpoint,
  DelegationTopicConfig,
  KafkaConsumerConfig,
  TokenGenerationConfig,
} from "pagopa-interop-commons";
import { z } from "zod";

export const APIProcessServerConfig = z
  .object({
    AGREEMENT_PROCESS_URL: APIEndpoint,
    PURPOSE_PROCESS_URL: APIEndpoint,
  })
  .transform((c) => ({
    agreementProcessUrl: c.AGREEMENT_PROCESS_URL,
    purposeProcessUrl: c.PURPOSE_PROCESS_URL,
  }));

const DelegationArchiverConfig = APIProcessServerConfig.and(
  DelegationTopicConfig
)
  .and(TokenGenerationConfig)
  .and(KafkaConsumerConfig);

export type DelegationArchiverConfig = z.infer<typeof DelegationArchiverConfig>;
export const config: DelegationArchiverConfig = DelegationArchiverConfig.parse(
  process.env
);
