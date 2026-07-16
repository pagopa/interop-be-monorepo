import {
  FileManager,
  formatDateyyyyMMdd,
  formatTimeHHmmss,
  InteropApiToken,
  InteropAsyncConsumerToken,
  InteropConsumerToken,
  Logger,
  secondsToMilliseconds,
} from "pagopa-interop-commons";
import {
  AgreementId,
  AsyncClientAssertion,
  ClientAssertion,
  CorrelationId,
  DescriptorId,
  DPoPProof,
  EServiceId,
  FullTokenGenerationStatesConsumerClient,
  GeneratedApiTokenAuditDetails,
  GeneratedConsumerTokenAuditDetails,
  generateId,
  InteractionAuditDetails,
  PurposeVersionId,
  TenantId,
  unsafeBrandId,
  UserId,
} from "pagopa-interop-models";
import {
  fallbackAuditFailed,
  kafkaAuditingFailed,
} from "../model/domain/errors.js";
import { initProducer } from "kafka-iam-auth";
import { config } from "../config/config.js";

type GeneratedAuditDetails =
  | GeneratedConsumerTokenAuditDetails
  | GeneratedApiTokenAuditDetails;

const buildAuditMessageDPopBody = (
  dpop: DPoPProof
): Pick<GeneratedAuditDetails, "dpop"> => ({
  dpop: {
    typ: dpop.header.typ,
    alg: dpop.header.alg,
    jwk: dpop.header.jwk,
    htm: dpop.payload.htm,
    htu: dpop.payload.htu,
    iat: secondsToMilliseconds(dpop.payload.iat),
    jti: dpop.payload.jti,
  },
});

const buildAuditMessageBodyForConsumerToken = ({
  generatedToken,
  clientAssertion,
  dpop,
  correlationId,
  organizationId,
  agreementId,
  eserviceId,
  descriptorId,
  purposeId,
  purposeVersionId,
  interaction,
}: {
  generatedToken: InteropConsumerToken | InteropAsyncConsumerToken;
  clientAssertion: ClientAssertion | AsyncClientAssertion;
  dpop: DPoPProof | undefined;
  correlationId: CorrelationId;
  organizationId: string;
  agreementId: string;
  eserviceId: EServiceId;
  descriptorId: DescriptorId;
  purposeId: string;
  purposeVersionId: string;
  interaction?: InteractionAuditDetails;
}): GeneratedConsumerTokenAuditDetails => ({
  jwtId: generatedToken.payload.jti,
  correlationId,
  issuedAt: secondsToMilliseconds(generatedToken.payload.iat),
  clientId: clientAssertion.payload.sub,
  organizationId: unsafeBrandId(organizationId),
  agreementId: unsafeBrandId(agreementId),
  eserviceId,
  descriptorId,
  purposeId: unsafeBrandId(purposeId),
  purposeVersionId: unsafeBrandId(purposeVersionId),
  algorithm: generatedToken.header.alg,
  keyId: generatedToken.header.kid,
  typ: generatedToken.header.typ,
  audience: [generatedToken.payload.aud].flat().join(","),
  subject: generatedToken.payload.sub,
  notBefore: secondsToMilliseconds(generatedToken.payload.nbf),
  expirationTime: secondsToMilliseconds(generatedToken.payload.exp),
  issuer: generatedToken.payload.iss,
  ...(generatedToken.payload.cnf ? { cnf: generatedToken.payload.cnf } : {}),
  ...(generatedToken.payload.digest
    ? { digest: generatedToken.payload.digest }
    : {}),
  clientAssertion: {
    algorithm: clientAssertion.header.alg,
    audience: [clientAssertion.payload.aud].flat().join(","),
    expirationTime: secondsToMilliseconds(clientAssertion.payload.exp),
    issuedAt: secondsToMilliseconds(clientAssertion.payload.iat),
    issuer: clientAssertion.payload.iss,
    jwtId: clientAssertion.payload.jti,
    keyId: clientAssertion.header.kid,
    subject: clientAssertion.payload.sub,
    ...(clientAssertion.payload.digest
      ? { digest: clientAssertion.payload.digest }
      : {}),
  },
  ...(dpop ? buildAuditMessageDPopBody(dpop) : {}),
  ...(interaction ? { interaction } : {}),
});

/** @lintignore TODO: PIN-10579 */
export const buildAuditMessageBodyForApiToken = ({
  generatedToken,
  clientAssertion,
  dpop,
  correlationId,
  organizationId,
  adminId,
}: {
  generatedToken: InteropApiToken;
  clientAssertion: ClientAssertion;
  dpop: DPoPProof | undefined;
  correlationId: CorrelationId;
  organizationId: TenantId;
  adminId: UserId | undefined;
}): GeneratedApiTokenAuditDetails => ({
  jwtId: generatedToken.payload.jti,
  correlationId,
  issuedAt: secondsToMilliseconds(generatedToken.payload.iat),
  clientId: clientAssertion.payload.sub,
  organizationId,
  adminId,

  algorithm: generatedToken.header.alg,
  keyId: generatedToken.header.kid,
  typ: generatedToken.header.typ,
  audience: [generatedToken.payload.aud].flat().join(","),
  subject: generatedToken.payload.sub,
  notBefore: secondsToMilliseconds(generatedToken.payload.nbf),
  expirationTime: secondsToMilliseconds(generatedToken.payload.exp),
  issuer: generatedToken.payload.iss,

  ...("cnf" in generatedToken.payload
    ? { cnf: generatedToken.payload.cnf }
    : {}),

  clientAssertion: {
    algorithm: clientAssertion.header.alg,
    audience: [clientAssertion.payload.aud].flat().join(","),
    expirationTime: secondsToMilliseconds(clientAssertion.payload.exp),
    issuedAt: secondsToMilliseconds(clientAssertion.payload.iat),
    issuer: clientAssertion.payload.iss,
    jwtId: clientAssertion.payload.jti,
    keyId: clientAssertion.header.kid,
    subject: clientAssertion.payload.sub,
  },

  ...(dpop ? buildAuditMessageDPopBody(dpop) : {}),
});

export const fallbackAudit = async ({
  messageBody,
  bucket,
  fileManager,
  logger,
}: {
  messageBody: GeneratedAuditDetails;
  bucket: string;
  fileManager: FileManager;
  logger: Logger;
}): Promise<void> => {
  const date = new Date();
  const ymdDate = formatDateyyyyMMdd(date);
  const hmsTime = formatTimeHHmmss(date);

  const fileName = `${ymdDate}_${hmsTime}_${generateId()}.ndjson`;
  const filePath = `token-details/${ymdDate}`;

  try {
    await fileManager.storeBytes(
      {
        bucket,
        path: filePath,
        name: fileName,
        content: Buffer.from(JSON.stringify(messageBody)),
      },
      logger
    );

    logger.info("Auditing succeeded through fallback");
  } catch (err) {
    logger.error(`Auditing fallback failed: ${err}`);
    throw fallbackAuditFailed(messageBody.clientId);
  }
};

const sendAuditMessage = async ({
  messageBody,
  producer,
  fallbackBucket,
  fileManager,
  logger,
}: {
  messageBody: GeneratedAuditDetails;
  producer: Awaited<ReturnType<typeof initProducer>>;
  fallbackBucket: string;
  fileManager: FileManager;
  logger: Logger;
}): Promise<void> => {
  try {
    const res = await producer.send({
      messages: [
        {
          key: messageBody.jwtId,
          value: JSON.stringify(messageBody),
        },
      ],
    });

    if (res.length === 0 || res[0].errorCode !== 0) {
      throw kafkaAuditingFailed();
    }
  } catch (e) {
    logger.error(
      `Main auditing flow failed, going through fallback. Error: ${
        e instanceof Error ? e.message : String(e)
      }`
    );

    await fallbackAudit({
      messageBody,
      bucket: fallbackBucket,
      fileManager,
      logger,
    });
  }
};

export const publishConsumerTokenAudit = async ({
  producer,
  generatedToken,
  key,
  eserviceId,
  descriptorId,
  clientAssertion,
  dpop,
  correlationId,
  fileManager,
  logger,
  interaction,
}: {
  producer: Awaited<ReturnType<typeof initProducer>>;
  generatedToken: InteropConsumerToken | InteropAsyncConsumerToken;
  key: FullTokenGenerationStatesConsumerClient;
  // Explicit eserviceId/descriptorId: for async flows they are pinned on the
  // Interaction at start_interaction and do NOT follow rewrites of the
  // token-generation-states row; passing them here keeps the audit coherent.
  eserviceId: EServiceId;
  descriptorId: DescriptorId;
  clientAssertion: ClientAssertion | AsyncClientAssertion;
  dpop: DPoPProof | undefined;
  correlationId: CorrelationId;
  fileManager: FileManager;
  logger: Logger;
  interaction?: InteractionAuditDetails;
}): Promise<void> => {
  const messageBody = buildAuditMessageBodyForConsumerToken({
    generatedToken,
    clientAssertion,
    dpop,
    correlationId,
    organizationId: key.consumerId,
    agreementId: key.agreementId,
    eserviceId,
    descriptorId,
    purposeId: key.GSIPK_purposeId,
    purposeVersionId: key.purposeVersionId,
    interaction,
  });

  await sendAuditMessage({
    messageBody,
    producer,
    fallbackBucket: config.s3BucketConsumerTokenAuditFallback,
    fileManager,
    logger,
  });
};

export const publishProducerAudit = async ({
  producer,
  generatedToken,
  organizationId,
  agreementId,
  eserviceId,
  descriptorId,
  purposeId,
  purposeVersionId,
  clientAssertion,
  dpop,
  correlationId,
  fileManager,
  logger,
  interaction,
}: {
  producer: Awaited<ReturnType<typeof initProducer>>;
  generatedToken: InteropAsyncConsumerToken;
  organizationId: TenantId;
  agreementId: AgreementId;
  eserviceId: EServiceId;
  descriptorId: DescriptorId;
  purposeId: string;
  purposeVersionId: PurposeVersionId;
  clientAssertion: AsyncClientAssertion;
  dpop: DPoPProof | undefined;
  correlationId: CorrelationId;
  fileManager: FileManager;
  logger: Logger;
  interaction?: InteractionAuditDetails;
}): Promise<void> => {
  const messageBody = buildAuditMessageBodyForConsumerToken({
    generatedToken,
    clientAssertion,
    dpop,
    correlationId,
    organizationId,
    agreementId,
    eserviceId,
    descriptorId,
    purposeId,
    purposeVersionId,
    interaction,
  });

  await sendAuditMessage({
    messageBody,
    producer,
    fileManager,
    fallbackBucket: config.s3BucketConsumerTokenAuditFallback,
    logger,
  });
};
