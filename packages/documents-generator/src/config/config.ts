import {
  AgreementTopicConfig,
  KafkaConsumerConfig,
  CatalogTopicConfig,
  PurposeTopicConfig,
  AuthorizationTopicConfig,
  DelegationTopicConfig,
  FileManagerConfig,
  LoggerConfig,
  S3Config,
  ReadModelSQLDbConfig,
  TokenGenerationConfig,
  PurposeTemplateTopicConfig,
  DelegationProcessServerConfig,
  PurposeProcessServerConfig,
  AgreementProcessServerConfig,
  PurposeTemplateProcessServerConfig,
} from "pagopa-interop-commons";
import { z } from "zod";

export const DocumentsGeneratorConfig = CatalogTopicConfig.and(
  AgreementTopicConfig
)
  .and(AuthorizationTopicConfig)
  .and(PurposeTopicConfig)
  .and(DelegationTopicConfig)
  .and(PurposeTemplateTopicConfig)
  .and(ReadModelSQLDbConfig.optional())
  .and(FileManagerConfig)
  .and(S3Config)
  .and(LoggerConfig)
  .and(TokenGenerationConfig)
  .and(DelegationProcessServerConfig)
  .and(PurposeProcessServerConfig)
  .and(AgreementProcessServerConfig)
  .and(PurposeTemplateProcessServerConfig)
  .and(
    z
      .object({
        DELEGATION_DOCUMENTS_PATH: z.string(),
        AGREEMENT_DOCUMENTS_PATH: z.string(),
        RISK_ANALYSIS_DOCUMENTS_PATH: z.string(),
        RISK_ANALYSIS_TEMPLATE_DOCUMENTS_PATH: z.string(),
      })
      .transform((c) => ({
        delegationDocumentsPath: c.DELEGATION_DOCUMENTS_PATH,
        agreementContractsPath: c.AGREEMENT_DOCUMENTS_PATH,
        riskAnalysisDocumentsPath: c.RISK_ANALYSIS_DOCUMENTS_PATH,
        riskAnalysisTemplateDocumentsPath:
          c.RISK_ANALYSIS_TEMPLATE_DOCUMENTS_PATH,
      }))
  );

export type DocumentsGeneratorConfig = z.infer<typeof DocumentsGeneratorConfig>;

export const config: DocumentsGeneratorConfig = DocumentsGeneratorConfig.parse(
  process.env
);

export const baseConsumerConfig: KafkaConsumerConfig =
  KafkaConsumerConfig.parse(process.env);
