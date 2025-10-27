import {
  LoggerConfig,
  FileManagerConfig,
  SafeStorageApiConfig,
  DynamoDBClientConfig,
  AWSConfig,
  APIEndpoint,
  TokenGenerationConfig,
} from "pagopa-interop-commons";
import { z } from "zod";
import { SQSConsumerConfig } from "./sqsConfig.js";

export const SignedObjectsPersisterConfig = SQSConsumerConfig.and(LoggerConfig)
  .and(FileManagerConfig)
  .and(SafeStorageApiConfig)
  .and(DynamoDBClientConfig)
  .and(AWSConfig)
  .and(TokenGenerationConfig)
  .and(
    z
      .object({
        SERVICE_NAME: z.string(),
        S3_BUCKET_SIGNED_DOCUMENTS: z.string(),
        S3_BUCKET_AUDIT: z.string(),
        S3_BUCKET_EVENTS: z.string(),
        DELEGATION_PROCESS_URL: APIEndpoint,
        PURPOSE_PROCESS_URL: APIEndpoint,
        AGREEMENT_PROCESS_URL: APIEndpoint,
      })
      .transform((c) => ({
        serviceName: c.SERVICE_NAME,
        signedDocumentsBucket: c.S3_BUCKET_SIGNED_DOCUMENTS,
        auditBucket: c.S3_BUCKET_AUDIT,
        eventsBucket: c.S3_BUCKET_EVENTS,
        delegationProcessUrl: c.DELEGATION_PROCESS_URL,
        purposeProcessUrl: c.PURPOSE_PROCESS_URL,
        agreementProcessUrl: c.AGREEMENT_PROCESS_URL,
      }))
  );

export type SignedObjectPersisterConfig = z.infer<
  typeof SignedObjectsPersisterConfig
>;

export const config: SignedObjectPersisterConfig =
  SignedObjectsPersisterConfig.parse(process.env);
