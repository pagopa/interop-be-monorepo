import {
  validateClientKindAndPlatformState,
  validateRequestParameters,
  verifyClientAssertion,
  verifyClientAssertionSignature,
} from "pagopa-interop-client-assertion-validation";
import { authorizationServerApi } from "pagopa-interop-api-clients";
import {
  clientKindTokenGenStates,
  DescriptorId,
  EServiceId,
  generateId,
  genericInternalError,
  makeTokenGenerationStatesClientKidPK,
  makeTokenGenerationStatesClientKidPurposePK,
  TenantId,
  TokenGenerationStatesApiClient,
  TokenGenerationStatesClientKidPK,
  TokenGenerationStatesClientKidPurposePK,
  TokenGenerationStatesGenericClient,
  unsafeBrandId,
  GeneratedTokenAuditDetails,
  GSIPKEServiceIdDescriptorId,
  ClientAssertion,
  FullTokenGenerationStatesConsumerClient,
  CorrelationId,
  ClientKindTokenGenStates,
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
  secondsToMilliseconds,
} from "pagopa-interop-commons";
import { initProducer } from "kafka-iam-auth";
import { config } from "../config/config.js";
import {
  clientAssertionRequestValidationFailed,
  clientAssertionSignatureValidationFailed,
  clientAssertionValidationFailed,
  fallbackAuditFailed,
  incompleteTokenGenerationStatesConsumerClient,
  kafkaAuditingFailed,
  tokenGenerationStatesEntryNotFound,
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
      correlationId: CorrelationId,
      logger: Logger
    ): Promise<GenerateTokenReturnType> {
      logger.info(`[CLIENTID=${request.client_id}] Token requested`);

      const { errors: parametersErrors } = validateRequestParameters({
        client_assertion: request.client_assertion,
        client_assertion_type: request.client_assertion_type,
        grant_type: request.grant_type,
        client_id: request.client_id,
      });

      if (parametersErrors) {
        throw clientAssertionRequestValidationFailed(
          request.client_id,
          parametersErrors.map((error) => error.detail).join(", ")
        );
      }

      const { data: jwt, errors: clientAssertionErrors } =
        verifyClientAssertion(
          request.client_assertion,
          request.client_id,
          config.clientAssertionAudience,
          logger
        );

      if (clientAssertionErrors) {
        throw clientAssertionValidationFailed(
          request.client_id,
          clientAssertionErrors.map((error) => error.detail).join(", ")
        );
      }

      const clientId = jwt.payload.sub;
      const kid = jwt.header.kid;
      const purposeId = jwt.payload.purposeId;

      logTokenGenerationInfo({
        validatedJwt: jwt,
        clientKind: undefined,
        tokenJti: undefined,
        message: "Client assertion validated",
        logger,
      });

      const pk = purposeId
        ? makeTokenGenerationStatesClientKidPurposePK({
            clientId,
            kid,
            purposeId,
          })
        : makeTokenGenerationStatesClientKidPK({ clientId, kid });

      const key = await retrieveKey(dynamoDBClient, pk);

      logTokenGenerationInfo({
        validatedJwt: jwt,
        clientKind: key.clientKind,
        tokenJti: undefined,
        message: "Key retrieved",
        logger,
      });

      const { errors: clientAssertionSignatureErrors } =
        await verifyClientAssertionSignature(
          request.client_assertion,
          key,
          jwt.header.alg
        );

      if (clientAssertionSignatureErrors) {
        throw clientAssertionSignatureValidationFailed(
          request.client_id,
          clientAssertionSignatureErrors.map((error) => error.detail).join(", ")
        );
      }

      const { errors: platformStateErrors } =
        validateClientKindAndPlatformState(key, jwt);
      if (platformStateErrors) {
        throw platformStateValidationFailed(
          platformStateErrors.map((error) => error.detail).join(", ")
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

      return await match(key)
        .with(
          { clientKind: clientKindTokenGenStates.consumer },
          async (key) => {
            const token = await tokenGenerator.generateInteropConsumerToken({
              sub: jwt.payload.sub,
              audience: key.descriptorAudience,
              purposeId: key.GSIPK_purposeId,
              tokenDurationInSeconds: key.descriptorVoucherLifespan,
              digest: jwt.payload.digest || undefined,
            });

            await publishAudit({
              producer,
              generatedToken: token,
              key,
              clientAssertion: jwt,
              correlationId,
              fileManager,
              logger,
            });

            logTokenGenerationInfo({
              validatedJwt: jwt,
              clientKind: key.clientKind,
              tokenJti: token.payload.jti,
              message: "Token generated",
              logger,
            });

            return {
              limitReached: false as const,
              token,
              rateLimiterStatus,
            };
          }
        )
        .with({ clientKind: clientKindTokenGenStates.api }, async (key) => {
          const token = await tokenGenerator.generateInteropApiToken({
            sub: jwt.payload.sub,
            consumerId: key.consumerId,
          });

          logTokenGenerationInfo({
            validatedJwt: jwt,
            clientKind: key.clientKind,
            tokenJti: token.payload.jti,
            message: "Token generated",
            logger,
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
  generatedToken: InteropConsumerToken;
  key: FullTokenGenerationStatesConsumerClient;
  clientAssertion: ClientAssertion;
  correlationId: CorrelationId;
  fileManager: FileManager;
  logger: Logger;
}): Promise<void> => {
  const messageBody: GeneratedTokenAuditDetails = {
    jwtId: generatedToken.payload.jti,
    correlationId,
    issuedAt: secondsToMilliseconds(generatedToken.payload.iat),
    clientId: clientAssertion.payload.sub,
    organizationId: key.consumerId,
    agreementId: key.agreementId,
    eserviceId: deconstructGSIPK_eserviceId_descriptorId(
      key.GSIPK_eserviceId_descriptorId
    ).eserviceId,
    descriptorId: deconstructGSIPK_eserviceId_descriptorId(
      key.GSIPK_eserviceId_descriptorId
    ).descriptorId,
    purposeId: key.GSIPK_purposeId,
    purposeVersionId: unsafeBrandId(key.purposeVersionId),
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

export const logTokenGenerationInfo = ({
  validatedJwt,
  clientKind,
  tokenJti,
  message,
  logger,
}: {
  validatedJwt: ClientAssertion;
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
