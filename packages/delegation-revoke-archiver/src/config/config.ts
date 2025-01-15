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

const DelegationRevokeArchiverConfig = APIProcessServerConfig.and(
  DelegationTopicConfig
)
  .and(TokenGenerationConfig)
  .and(KafkaConsumerConfig);

export type DelegationRevokeArchiverConfig = z.infer<
  typeof DelegationRevokeArchiverConfig
>;
export const config: DelegationRevokeArchiverConfig =
  DelegationRevokeArchiverConfig.parse(process.env);
