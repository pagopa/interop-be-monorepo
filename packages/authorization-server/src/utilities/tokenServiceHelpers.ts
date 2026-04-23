import {
  AgreementId,
  AsyncClientAssertion,
  clientKindTokenGenStates,
  ClientAssertion,
  ClientKindTokenGenStates,
  CorrelationId,
  DescriptorId,
  DPoPProof,
  EServiceId,
  FullTokenGenerationStatesConsumerClient,
  GeneratedTokenAuditDetails,
  generateId,
  genericInternalError,
  GSIPKEServiceIdDescriptorId,
  makePlatformStatesEServiceDescriptorPK,
  makeProducerKeychainPlatformStatesPK,
  PlatformStatesCatalogEntry,
  ProducerKeychainId,
  ProducerKeychainPlatformStatesPK,
  PurposeId,
  PurposeVersionId,
  TokenGenerationStatesApiClient,
  TokenGenerationStatesClientKidPK,
  TokenGenerationStatesClientKidPurposePK,
  TokenGenStatesConsumerClientGSIPurpose,
  TenantId,
  TokenGenerationStatesGenericClient,
  unsafeBrandId,
} from "pagopa-interop-models";
import {
  DynamoDBClient,
  GetItemCommand,
  GetItemCommandOutput,
  GetItemInput,
  QueryCommand,
  QueryCommandOutput,
  QueryInput,
} from "@aws-sdk/client-dynamodb";
import { unmarshall } from "@aws-sdk/util-dynamodb";
import { z } from "zod";
import { match } from "ts-pattern";
import {
  FileManager,
  formatDateyyyyMMdd,
  formatTimeHHmmss,
  InteropAsyncConsumerToken,
  InteropConsumerToken,
  Logger,
  secondsToMilliseconds,
} from "pagopa-interop-commons";
import { initProducer } from "kafka-iam-auth";
import {
  verifyDPoPProof,
  verifyDPoPProofSignature,
} from "pagopa-interop-dpop-validation";
import { config } from "../config/config.js";
import {
  catalogEntryNotFound,
  dpopProofSignatureValidationFailed,
  dpopProofValidationFailed,
  fallbackAuditFailed,
  incompleteTokenGenerationStatesConsumerClient,
  kafkaAuditingFailed,
  producerKeychainEntryNotFound,
  tokenGenerationStatesEntryNotFound,
  tokenGenerationStatesEntriesByPurposeIdNotFound,
} from "../model/domain/errors.js";

const EXPECTED_HTM = "POST";

export const retrieveKey = async (
  dynamoDBClient: DynamoDBClient,
  pk: TokenGenerationStatesClientKidPurposePK | TokenGenerationStatesClientKidPK
): Promise<
  FullTokenGenerationStatesConsumerClient | TokenGenerationStatesApiClient
> => {
  const input: GetItemInput = {
    Key: {
      PK: { S: pk },
    },
    TableName: config.tokenGenerationStatesTable,
  };

  const command = new GetItemCommand(input);
  const data: GetItemCommandOutput = await dynamoDBClient.send(command);

  if (!data.Item) {
    throw tokenGenerationStatesEntryNotFound(pk);
  } else {
    const unmarshalled = unmarshall(data.Item);
    const tokenGenStatesClient =
      TokenGenerationStatesGenericClient.safeParse(unmarshalled);

    if (!tokenGenStatesClient.success) {
      throw genericInternalError(
        `Unable to parse token-generation-states client: result ${JSON.stringify(
          tokenGenStatesClient
        )} - data ${JSON.stringify(data)} `
      );
    }

    return match(tokenGenStatesClient.data)
      .with({ clientKind: clientKindTokenGenStates.consumer }, (entry) => {
        const tokenGenStatesConsumerClient =
          FullTokenGenerationStatesConsumerClient.safeParse(entry);
        if (!tokenGenStatesConsumerClient.success) {
          throw incompleteTokenGenerationStatesConsumerClient(entry.PK);
        }

        return tokenGenStatesConsumerClient.data;
      })
      .with({ clientKind: clientKindTokenGenStates.api }, (entry) => entry)
      .exhaustive();
  }
};

export const retrieveCatalogEntry = async (
  dynamoDBClient: DynamoDBClient,
  eserviceId: EServiceId,
  descriptorId: DescriptorId,
  platformStatesTable: string
): Promise<PlatformStatesCatalogEntry> => {
  const pk = makePlatformStatesEServiceDescriptorPK({
    eserviceId,
    descriptorId,
  });

  const input: GetItemInput = {
    Key: {
      PK: { S: pk },
    },
    TableName: platformStatesTable,
  };

  const command = new GetItemCommand(input);
  const data: GetItemCommandOutput = await dynamoDBClient.send(command);

  if (!data.Item) {
    throw catalogEntryNotFound(eserviceId, descriptorId);
  }

  const unmarshalled = unmarshall(data.Item);
  const catalogEntry = PlatformStatesCatalogEntry.safeParse(unmarshalled);

  if (!catalogEntry.success) {
    throw genericInternalError(
      `Unable to parse platform-states catalog entry: result ${JSON.stringify(
        catalogEntry
      )} - data ${JSON.stringify(data)} `
    );
  }

  return catalogEntry.data;
};

export const retrieveTokenGenStatesEntryByPurposeId = async (
  dynamoDBClient: DynamoDBClient,
  purposeId: PurposeId,
  tokenGenerationStatesTable: string
): Promise<TokenGenStatesConsumerClientGSIPurpose> => {
  const input: QueryInput = {
    TableName: tokenGenerationStatesTable,
    IndexName: "Purpose",
    KeyConditionExpression: "GSIPK_purposeId = :purposeId",
    ExpressionAttributeValues: {
      ":purposeId": { S: purposeId },
    },
    Limit: 1,
  };

  const command = new QueryCommand(input);
  const data: QueryCommandOutput = await dynamoDBClient.send(command);

  if (!data.Items || data.Items.length === 0) {
    throw tokenGenerationStatesEntriesByPurposeIdNotFound(purposeId);
  }

  const unmarshalled = unmarshall(data.Items[0]);
  const entry = TokenGenStatesConsumerClientGSIPurpose.safeParse(unmarshalled);

  if (!entry.success) {
    throw genericInternalError(
      `Unable to parse token-generation-states entry from Purpose GSI: result ${JSON.stringify(
        entry
      )} - data ${JSON.stringify(data)} `
    );
  }

  return entry.data;
};

const buildAuditMessageBody = ({
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
}): GeneratedTokenAuditDetails => ({
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
  audience: [generatedToken.payload.aud].flat().join(","),
  subject: generatedToken.payload.sub,
  notBefore: secondsToMilliseconds(generatedToken.payload.nbf),
  expirationTime: secondsToMilliseconds(generatedToken.payload.exp),
  issuer: generatedToken.payload.iss,
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
  ...(dpop
    ? {
        dpop: {
          typ: dpop.header.typ,
          alg: dpop.header.alg,
          jwk: dpop.header.jwk,
          htm: dpop.payload.htm,
          htu: dpop.payload.htu,
          iat: secondsToMilliseconds(dpop.payload.iat),
          jti: dpop.payload.jti,
        },
      }
    : {}),
});

const sendAuditMessage = async ({
  messageBody,
  producer,
  fileManager,
  logger,
}: {
  messageBody: GeneratedTokenAuditDetails;
  producer: Awaited<ReturnType<typeof initProducer>>;
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
    await fallbackAudit(messageBody, fileManager, logger);
  }
};

export const publishAudit = async ({
  producer,
  generatedToken,
  key,
  clientAssertion,
  dpop,
  correlationId,
  fileManager,
  logger,
}: {
  producer: Awaited<ReturnType<typeof initProducer>>;
  generatedToken: InteropConsumerToken | InteropAsyncConsumerToken;
  key: FullTokenGenerationStatesConsumerClient;
  clientAssertion: ClientAssertion | AsyncClientAssertion;
  dpop: DPoPProof | undefined;
  correlationId: CorrelationId;
  fileManager: FileManager;
  logger: Logger;
}): Promise<void> => {
  const { eserviceId, descriptorId } = deconstructGSIPK_eserviceId_descriptorId(
    key.GSIPK_eserviceId_descriptorId
  );
  const messageBody = buildAuditMessageBody({
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
  });

  await sendAuditMessage({ messageBody, producer, fileManager, logger });
};

export const fallbackAudit = async (
  messageBody: GeneratedTokenAuditDetails,
  fileManager: FileManager,
  logger: Logger
): Promise<void> => {
  const date = new Date();
  const ymdDate = formatDateyyyyMMdd(date);
  const hmsTime = formatTimeHHmmss(date);

  const fileName = `${ymdDate}_${hmsTime}_${generateId()}.ndjson`;
  const filePath = `token-details/${ymdDate}`;

  try {
    await fileManager.storeBytes(
      {
        bucket: config.s3Bucket,
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
}): Promise<void> => {
  const messageBody = buildAuditMessageBody({
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
  });

  await sendAuditMessage({ messageBody, producer, fileManager, logger });
};

export const deconstructGSIPK_eserviceId_descriptorId = (
  gsi: GSIPKEServiceIdDescriptorId
): { eserviceId: EServiceId; descriptorId: DescriptorId } => {
  const substrings = gsi.split("#");
  const eserviceId = substrings[0];
  const descriptorId = substrings[1];
  const parsedEserviceId = EServiceId.safeParse(eserviceId);

  if (!parsedEserviceId.success) {
    throw genericInternalError(
      `Unable to parse extract eserviceId from GSIPKEServiceIdDescriptorId: ${GSIPKEServiceIdDescriptorId}`
    );
  }

  const parsedDescriptorId = DescriptorId.safeParse(descriptorId);

  if (!parsedDescriptorId.success) {
    throw genericInternalError(
      `Unable to parse extract descriptorId from GSIPKEServiceIdDescriptorId: ${GSIPKEServiceIdDescriptorId}`
    );
  }

  return {
    eserviceId: parsedEserviceId.data,
    descriptorId: parsedDescriptorId.data,
  };
};

export const logTokenGenerationInfo = ({
  validatedJwt,
  clientKind,
  tokenJti,
  message,
  logger,
}: {
  validatedJwt: ClientAssertion | AsyncClientAssertion;
  clientKind: ClientKindTokenGenStates | undefined;
  tokenJti: string | undefined;
  message: string;
  logger: Logger;
}): void => {
  const clientId = `[CLIENTID=${validatedJwt.payload.sub}]`;
  const kid = `[KID=${validatedJwt.header.kid}]`;
  const purposeId = `[PURPOSEID=${validatedJwt.payload.purposeId}]`;
  const tokenType = `[TYPE=${clientKind}]`;
  const jti = `[JTI=${tokenJti}]`;
  logger.info(`${clientId}${kid}${purposeId}${tokenType}${jti} - ${message}`);
};

const ProducerKeychainPlatformStateEntry = z.object({
  PK: ProducerKeychainPlatformStatesPK,
  publicKey: z.string(),
  producerKeychainId: ProducerKeychainId,
  producerId: TenantId,
  kid: z.string(),
  eServiceId: EServiceId,
  version: z.number(),
  updatedAt: z.string(),
});
type ProducerKeychainPlatformStateEntry = z.infer<
  typeof ProducerKeychainPlatformStateEntry
>;

export const retrieveProducerKey = async (
  dynamoDBClient: DynamoDBClient,
  tableName: string,
  {
    producerKeychainId,
    kid,
    eServiceId,
  }: {
    producerKeychainId: ProducerKeychainId;
    kid: string;
    eServiceId: EServiceId;
  }
): Promise<ProducerKeychainPlatformStateEntry> => {
  const pk = makeProducerKeychainPlatformStatesPK({
    producerKeychainId,
    kid,
    eServiceId,
  });
  const input: GetItemInput = {
    Key: {
      PK: { S: pk },
    },
    TableName: tableName,
    ConsistentRead: true,
  };

  const data: GetItemCommandOutput = await dynamoDBClient.send(
    new GetItemCommand(input)
  );

  if (!data.Item) {
    throw producerKeychainEntryNotFound(producerKeychainId, kid, eServiceId);
  }

  const unmarshalled = unmarshall(data.Item);
  const entry = ProducerKeychainPlatformStateEntry.safeParse(unmarshalled);

  if (!entry.success) {
    throw genericInternalError(
      `Unable to parse producer-keychain-platform-states entry: result ${JSON.stringify(
        entry
      )} - data ${JSON.stringify(data)} `
    );
  }

  return entry.data;
};

export const validateDPoPProof = async (
  dpopProofHeader: string | undefined,
  clientId: string | undefined,
  logger: Logger
): Promise<{
  dpopProofJWS: string | undefined;
  dpopProofJWT: DPoPProof | undefined;
}> => {
  const { data, errors: dpopProofErrors } = dpopProofHeader
    ? verifyDPoPProof({
        dpopProofJWS: dpopProofHeader,
        expectedDPoPProofHtu: config.dpopHtuBase,
        expectedDPoPProofHtm: EXPECTED_HTM,
        dpopProofIatToleranceSeconds: config.dpopIatToleranceSeconds,
        dpopProofDurationSeconds: config.dpopDurationSeconds,
      })
    : { data: undefined, errors: undefined };

  if (dpopProofErrors) {
    throw dpopProofValidationFailed(
      clientId,
      dpopProofErrors.map((error) => error.detail).join(", ")
    );
  }

  const dpopProofJWT = data?.dpopProofJWT;
  const dpopProofJWS = data?.dpopProofJWS;

  if (dpopProofJWT && dpopProofJWS) {
    const { errors: dpopProofSignatureErrors } = await verifyDPoPProofSignature(
      dpopProofJWS,
      dpopProofJWT.header.jwk
    );

    if (dpopProofSignatureErrors) {
      throw dpopProofSignatureValidationFailed(
        clientId,
        dpopProofSignatureErrors.map((error) => error.detail).join(", ")
      );
    }

    logger.info(`[JTI=${dpopProofJWT.payload.jti}] - DPoP proof validated`);
  }

  return { dpopProofJWS, dpopProofJWT };
};
