import {
  LoggerConfig,
  FileManagerConfig,
  SafeStorageApiConfig,
  DynamoDBClientConfig,
  AWSConfig,
  AgreementProcessServerConfig,
  DelegationProcessServerConfig,
  PurposeProcessServerConfig,
  PurposeTemplateProcessServerConfig,
  TokenGenerationConfig,
} from "pagopa-interop-commons";
import { z } from "zod";

import { SQSConsumerConfig } from "./sqsConfig.js";

const SignedObjectsPersisterConfig = SQSConsumerConfig.and(LoggerConfig)
  .and(FileManagerConfig)
  .and(SafeStorageApiConfig)
  .and(DynamoDBClientConfig)
  .and(AWSConfig)
  .and(TokenGenerationConfig)
  .and(DelegationProcessServerConfig)
  .and(PurposeProcessServerConfig)
  .and(PurposeTemplateProcessServerConfig)
  .and(AgreementProcessServerConfig)
  .and(
    z
      .object({
        S3_BUCKET_SIGNED_DOCUMENTS: z.string(),
        S3_BUCKET_AUDIT: z.string(),
        S3_BUCKET_M2M_AUDIT: z.string(),
        S3_BUCKET_EVENTS: z.string(),
      })
      .transform((c) => ({
        signedDocumentsBucket: c.S3_BUCKET_SIGNED_DOCUMENTS,
        auditBucket: c.S3_BUCKET_AUDIT,
        m2mAuditBucket: c.S3_BUCKET_M2M_AUDIT,
        eventsBucket: c.S3_BUCKET_EVENTS,
      }))
  );

type SignedObjectPersisterConfig = z.infer<typeof SignedObjectsPersisterConfig>;

export const config: SignedObjectPersisterConfig =
  SignedObjectsPersisterConfig.parse(process.env);
