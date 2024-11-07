import {
  validateClientKindAndPlatformState,
  validateRequestParameters,
  verifyClientAssertion,
  verifyClientAssertionSignature,
} from "pagopa-interop-client-assertion-validation";
import { authorizationServerApi } from "pagopa-interop-api-clients";
import {
  clientKidPrefix,
  clientKidPurposePrefix,
  clientKindTokenStates,
  DescriptorId,
  EServiceId,
  generateId,
  genericInternalError,
  makeTokenGenerationStatesClientKidPK,
  makeTokenGenerationStatesClientKidPurposePK,
  TenantId,
  TokenGenerationStatesClientEntry,
  TokenGenerationStatesClientKidPK,
  TokenGenerationStatesClientKidPurposePK,
  TokenGenerationStatesClientPurposeEntry,
  TokenGenerationStatesGenericEntry,
  unsafeBrandId,
  GeneratedTokenAuditDetails,
  GSIPKEServiceIdDescriptorId,
  ClientAssertion,
  FullTokenGenerationStatesClientPurposeEntry,
} from "pagopa-interop-models";
import {
  DynamoDBClient,
  GetItemCommand,
  GetItemCommandOutput,
  GetItemInput,
} from "@aws-sdk/client-dynamodb";
import { unmarshall } from "@aws-sdk/util-dynamodb";
import { match } from "ts-pattern";
import {
  FileManager,
  formatDateyyyyMMdd,
  formatTimehhmmss,
  InteropApiToken,
  InteropConsumerToken,
  InteropTokenGenerator,
  Logger,
  RateLimiter,
  RateLimiterStatus,
} from "pagopa-interop-commons";
import { initProducer } from "kafka-iam-auth";
import { config } from "../config/config.js";
import {
  clientAssertionRequestValidationFailed,
  clientAssertionSignatureValidationFailed,
  clientAssertionValidationFailed,
  fallbackAuditFailed,
  invalidTokenClientKidPurposeEntry,
  kafkaAuditingFailed,
  tokenGenerationStatesEntryNotFound,
  keyTypeMismatch,
  unexpectedTokenGenerationStatesEntry,
  platformStateValidationFailed,
} from "../model/domain/errors.js";

export type GenerateTokenReturnType =
  | {
      limitReached: true;
      token: undefined;
      rateLimitedTenantId: TenantId;
      rateLimiterStatus: Omit<RateLimiterStatus, "limitReached">;
    }
  | {
      limitReached: false;
      token: InteropConsumerToken | InteropApiToken;
      rateLimiterStatus: Omit<RateLimiterStatus, "limitReached">;
    };

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function tokenServiceBuilder({
  tokenGenerator,
  dynamoDBClient,
  redisRateLimiter,
  producer,
  fileManager,
}: {
  tokenGenerator: InteropTokenGenerator;
  dynamoDBClient: DynamoDBClient;
  redisRateLimiter: RateLimiter;
  producer: Awaited<ReturnType<typeof initProducer>>;
  fileManager: FileManager;
}) {
  return {
    async generateToken(
      request: authorizationServerApi.AccessTokenRequest,
      correlationId: string,
      logger: Logger
    ): Promise<GenerateTokenReturnType> {
      const { errors: parametersErrors } = validateRequestParameters({
        client_assertion: request.client_assertion,
        client_assertion_type: request.client_assertion_type,
        grant_type: request.grant_type,
        client_id: request.client_id,
      });

      if (parametersErrors) {
        throw clientAssertionRequestValidationFailed(request.client_id);
      }

      const { data: jwt, errors: clientAssertionErrors } =
        verifyClientAssertion(request.client_assertion, request.client_id);

      if (clientAssertionErrors) {
        throw clientAssertionValidationFailed(request.client_id);
      }

      const clientId = jwt.payload.sub;
      const kid = jwt.header.kid;
      const purposeId = jwt.payload.purposeId;

      const pk = purposeId
        ? makeTokenGenerationStatesClientKidPurposePK({
            clientId,
            kid,
            purposeId,
          })
        : makeTokenGenerationStatesClientKidPK({ clientId, kid });

      const key = await retrieveKey(dynamoDBClient, pk);

      const { errors: clientAssertionSignatureErrors } =
        await verifyClientAssertionSignature(
          request.client_assertion,
          key,
          jwt.header.alg
        );

      if (clientAssertionSignatureErrors) {
        throw clientAssertionSignatureValidationFailed(request.client_id);
      }

      const { errors: platformStateErrors } =
        validateClientKindAndPlatformState(key, jwt);
      if (platformStateErrors) {
        throw platformStateValidationFailed(
          platformStateErrors.map((error) => error.detail)
        );
      }

      const { limitReached, ...rateLimiterStatus } =
        await redisRateLimiter.rateLimitByOrganization(key.consumerId, logger);
      if (limitReached) {
        return {
          limitReached: true,
          token: undefined,
          rateLimitedTenantId: key.consumerId,
          rateLimiterStatus,
        };
      }

      return await match(key.clientKind)
        .with(clientKindTokenStates.consumer, async () => {
          const parsedKey =
            FullTokenGenerationStatesClientPurposeEntry.safeParse(key);
          if (parsedKey.success) {
            const token = await tokenGenerator.generateInteropConsumerToken({
              sub: jwt.payload.sub,
              audience: parsedKey.data.descriptorAudience,
              purposeId: parsedKey.data.GSIPK_purposeId,
              tokenDurationInSeconds: parsedKey.data.descriptorVoucherLifespan,
              digest: jwt.payload.digest,
            });

            await publishAudit({
              producer,
              generatedToken: token,
              key: parsedKey.data,
              clientAssertion: jwt,
              correlationId,
              fileManager,
              logger,
            });

            return {
              limitReached: false as const,
              token,
              rateLimiterStatus,
            };
          }
          throw invalidTokenClientKidPurposeEntry(key.PK);
        })
        .with(clientKindTokenStates.api, async () => {
          const token = await tokenGenerator.generateInteropApiToken({
            sub: jwt.payload.sub,
            consumerId: key.consumerId,
          });

          return {
            limitReached: false as const,
            token,
            rateLimiterStatus,
          };
        })
        .exhaustive();
    },
  };
}

export const retrieveKey = async (
  dynamoDBClient: DynamoDBClient,
  pk: TokenGenerationStatesClientKidPurposePK | TokenGenerationStatesClientKidPK
): Promise<
  TokenGenerationStatesClientEntry | TokenGenerationStatesClientPurposeEntry
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
    const tokenGenerationEntry =
      TokenGenerationStatesGenericEntry.safeParse(unmarshalled);

    if (!tokenGenerationEntry.success) {
      throw genericInternalError(
        `Unable to parse token generation entry item: result ${JSON.stringify(
          tokenGenerationEntry
        )} - data ${JSON.stringify(data)} `
      );
    }

    return match(tokenGenerationEntry.data)
      .when(
        (entry) =>
          entry.clientKind === clientKindTokenStates.consumer &&
          entry.PK.startsWith(clientKidPurposePrefix),
        () => {
          const clientKidPurposeEntry =
            FullTokenGenerationStatesClientPurposeEntry.safeParse(
              tokenGenerationEntry.data
            );
          if (!clientKidPurposeEntry.success) {
            throw invalidTokenClientKidPurposeEntry(
              tokenGenerationEntry.data.PK
            );
          }

          return clientKidPurposeEntry.data;
        }
      )
      .when(
        (entry) =>
          entry.clientKind === clientKindTokenStates.consumer &&
          entry.PK.startsWith(clientKidPrefix),
        (entry) => {
          throw keyTypeMismatch(entry.PK, entry.clientKind);
        }
      )
      .when(
        (entry) =>
          entry.clientKind === clientKindTokenStates.api &&
          entry.PK.startsWith(clientKidPurposePrefix),
        (entry) => {
          throw keyTypeMismatch(entry.PK, entry.clientKind);
        }
      )
      .when(
        (entry) =>
          entry.clientKind === clientKindTokenStates.api &&
          entry.PK.startsWith(clientKidPrefix),
        () => tokenGenerationEntry.data as TokenGenerationStatesClientEntry
      )
      .otherwise(() => {
        throw unexpectedTokenGenerationStatesEntry(
          tokenGenerationEntry.data.PK
        );
      });
  }
};

export const publishAudit = async ({
  producer,
  generatedToken,
  key,
  clientAssertion,
  correlationId,
  fileManager,
  logger,
}: {
  producer: Awaited<ReturnType<typeof initProducer>>;
  generatedToken: InteropConsumerToken | InteropApiToken;
  key: TokenGenerationStatesClientPurposeEntry;
  clientAssertion: ClientAssertion;
  correlationId: string;
  fileManager: FileManager;
  logger: Logger;
}): Promise<void> => {
  const parsedClientKidPurposeEntry =
    FullTokenGenerationStatesClientPurposeEntry.safeParse(key);
  if (!parsedClientKidPurposeEntry.success) {
    throw invalidTokenClientKidPurposeEntry(key.PK);
  }
  const messageBody: GeneratedTokenAuditDetails = {
    jwtId: generatedToken.payload.jti,
    correlationId,
    issuedAt: generatedToken.payload.iat,
    clientId: clientAssertion.payload.sub,
    organizationId: parsedClientKidPurposeEntry.data.consumerId,
    agreementId: parsedClientKidPurposeEntry.data.agreementId,
    eserviceId: deconstructGSIPK_eserviceId_descriptorId(
      parsedClientKidPurposeEntry.data.GSIPK_eserviceId_descriptorId
    ).eserviceId,
    descriptorId: deconstructGSIPK_eserviceId_descriptorId(
      parsedClientKidPurposeEntry.data.GSIPK_eserviceId_descriptorId
    ).descriptorId,
    purposeId: parsedClientKidPurposeEntry.data.GSIPK_purposeId,
    purposeVersionId: unsafeBrandId(
      parsedClientKidPurposeEntry.data.purposeVersionId
    ),
    algorithm: generatedToken.header.alg,
    keyId: generatedToken.header.kid,
    audience: generatedToken.payload.aud.join(","),
    subject: generatedToken.payload.sub,
    notBefore: generatedToken.payload.nbf,
    expirationTime: generatedToken.payload.exp,
    issuer: generatedToken.payload.iss,
    clientAssertion: {
      algorithm: clientAssertion.header.alg,
      audience: [clientAssertion.payload.aud].flat().join(","),
      expirationTime: clientAssertion.payload.exp,
      issuedAt: clientAssertion.payload.iat,
      issuer: clientAssertion.payload.iss,
      jwtId: clientAssertion.payload.jti,
      keyId: clientAssertion.header.kid,
      subject: clientAssertion.payload.sub,
    },
  };

  try {
    const res = await producer.send({
      messages: [
        {
          key: generatedToken.payload.jti,
          value: JSON.stringify(messageBody),
        },
      ],
    });
    if (res.length === 0 || res[0].errorCode !== 0) {
      throw kafkaAuditingFailed();
    }
  } catch (e) {
    logger.info("main auditing flow failed, going through fallback");
    await fallbackAudit(messageBody, fileManager, logger);
  }
};

export const fallbackAudit = async (
  messageBody: GeneratedTokenAuditDetails,
  fileManager: FileManager,
  logger: Logger
): Promise<void> => {
  const date = new Date();
  const ymdDate = formatDateyyyyMMdd(date);
  const hmsTime = formatTimehhmmss(date);

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
    logger.info("auditing succeeded through fallback");
  } catch {
    throw fallbackAuditFailed(messageBody.clientId);
  }
};

const deconstructGSIPK_eserviceId_descriptorId = (
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
