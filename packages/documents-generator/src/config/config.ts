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
  APIEndpoint,
} from "pagopa-interop-commons";
import { z } from "zod";

export const DocumentsGeneratorConfig = CatalogTopicConfig.and(
  AgreementTopicConfig
)
  .and(AuthorizationTopicConfig)
  .and(PurposeTopicConfig)
  .and(DelegationTopicConfig)
  .and(ReadModelSQLDbConfig.optional())
  .and(FileManagerConfig)
  .and(S3Config)
  .and(LoggerConfig)
  .and(TokenGenerationConfig)
  .and(
    z
      .object({
        SERVICE_NAME: z.string(),
        DELEGATION_DOCUMENT_PATH: z.string(),
        AGREEMENT_DOCUMENT_PATH: z.string(),
        RISK_ANALYSIS_DOCUMENT_PATH: z.string(),
        DELEGATION_PROCESS_URL: APIEndpoint,
        PURPOSE_PROCESS_URL: APIEndpoint,
        AGREEMENT_PROCESS_URL: APIEndpoint,
      })
      .transform((c) => ({
        serviceName: c.SERVICE_NAME,
        delegationDocumentPath: c.DELEGATION_DOCUMENT_PATH,
        agreementContractsPath: c.AGREEMENT_DOCUMENT_PATH,
        riskAnalysisDocumentsPath: c.RISK_ANALYSIS_DOCUMENT_PATH,
        delegationProcessUrl: c.DELEGATION_PROCESS_URL,
        purposeProcessUrl: c.PURPOSE_PROCESS_URL,
        agreementProcessUrl: c.AGREEMENT_PROCESS_URL,
      }))
  );

export type DocumentsGeneratorConfig = z.infer<typeof DocumentsGeneratorConfig>;

export const config: DocumentsGeneratorConfig = DocumentsGeneratorConfig.parse(
  process.env
);

export const baseConsumerConfig: KafkaConsumerConfig =
  KafkaConsumerConfig.parse(process.env);
