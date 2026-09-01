import {
  AgreementProcessServerConfig,
  PurposeProcessServerConfig,
  DelegationTopicConfig,
  KafkaConsumerConfig,
  ReadModelSQLDbConfig,
  TokenGenerationConfig,
} from "pagopa-interop-commons";
import { z } from "zod";

const DelegationItemsArchiverConfig = AgreementProcessServerConfig.and(
  PurposeProcessServerConfig
)
  .and(DelegationTopicConfig)
  .and(TokenGenerationConfig)
  .and(KafkaConsumerConfig)
  .and(ReadModelSQLDbConfig);

type DelegationItemsArchiverConfig = z.infer<
  typeof DelegationItemsArchiverConfig
>;
export const config: DelegationItemsArchiverConfig =
  DelegationItemsArchiverConfig.parse(process.env);
