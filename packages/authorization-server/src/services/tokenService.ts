import { IncomingHttpHeaders } from "http";
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
  ClientId,
  DPoPProof,
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
  AuthServerAppContext,
  FileManager,
  formatDateyyyyMMdd,
  formatTimeHHmmss,
  InteropApiToken,
  InteropConsumerToken,
  InteropTokenGenerator,
  isFeatureFlagEnabled,
  Logger,
  RateLimiter,
  RateLimiterStatus,
  secondsToMilliseconds,
  WithLogger,
} from "pagopa-interop-commons";
import { initProducer } from "kafka-iam-auth";
import {
  checkDPoPCache,
  verifyDPoPProof,
  verifyDPoPProofSignature,
} from "pagopa-interop-dpop-validation";
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
  dpopProofValidationFailed,
  dpopProofSignatureValidationFailed,
  dpopProofJtiAlreadyUsed,
} from "../model/domain/errors.js";
import { HttpDPoPHeader } from "../model/domain/models.js";

const EXPECTED_HTM = "POST";

export type GeneratedTokenData =
  | {
      limitReached: true;
      token: undefined;
      rateLimitedTenantId: TenantId;
      rateLimiterStatus: Omit<RateLimiterStatus, "limitReached">;
      isDPoP: boolean;
    }
  | {
      limitReached: false;
      token: InteropConsumerToken | InteropApiToken;
      rateLimiterStatus: Omit<RateLimiterStatus, "limitReached">;
      isDPoP?: boolean;
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
    // eslint-disable-next-line max-params
    async generateToken(
      headers: IncomingHttpHeaders & HttpDPoPHeader,
      body: authorizationServerApi.AccessTokenRequest,
      getCtx: () => WithLogger<AuthServerAppContext>,
      setCtxClientId: (clientId: ClientId) => void,
      setCtxClientKind: (tokenGenClientKind: ClientKindTokenGenStates) => void,
      setCtxOrganizationId: (organizationId: TenantId) => void
    ): Promise<GeneratedTokenData> {
      if (body.client_id) {
        setCtxClientId(unsafeBrandId(body.client_id));
      }

      getCtx().logger.info(`[CLIENTID=${body.client_id}] Token requested`);

      // DPoP proof validation
      const { dpopProofJWT } = await validateDPoPProof(
        headers.DPoP,
        body.client_id,
        getCtx().logger
      );

      // Request body parameters validation
      const { errors: parametersErrors } = validateRequestParameters({
        client_assertion: body.client_assertion,
        client_assertion_type: body.client_assertion_type,
        grant_type: body.grant_type,
        client_id: body.client_id,
      });

      if (parametersErrors) {
        throw clientAssertionRequestValidationFailed(
          body.client_id,
          parametersErrors.map((error) => error.detail).join(", ")
        );
      }

      // Client assertion validation
      const { data: clientAssertionJWT, errors: clientAssertionErrors } =
        verifyClientAssertion(
          body.client_assertion,
          body.client_id,
          config.clientAssertionAudience,
          getCtx().logger,
          isFeatureFlagEnabled(
            config,
            "featureFlagClientAssertionStrictClaimsValidation"
          )
        );

      if (clientAssertionErrors) {
        throw clientAssertionValidationFailed(
          body.client_id,
          clientAssertionErrors.map((error) => error.detail).join(", ")
        );
      }

      const clientId = clientAssertionJWT.payload.sub;
      const kid = clientAssertionJWT.header.kid;
      const purposeId = clientAssertionJWT.payload.purposeId;

      setCtxClientId(clientId);

      logTokenGenerationInfo({
        validatedJwt: clientAssertionJWT,
        clientKind: undefined,
        tokenJti: undefined,
        message: "Client assertion validated",
        logger: getCtx().logger,
      });

      const pk = purposeId
        ? makeTokenGenerationStatesClientKidPurposePK({
            clientId,
            kid,
            purposeId,
          })
        : makeTokenGenerationStatesClientKidPK({ clientId, kid });

      const key = await retrieveKey(dynamoDBClient, pk);

      setCtxOrganizationId(key.consumerId);
      setCtxClientKind(key.clientKind);

      logTokenGenerationInfo({
        validatedJwt: clientAssertionJWT,
        clientKind: key.clientKind,
        tokenJti: undefined,
        message: "Key retrieved",
        logger: getCtx().logger,
      });

      const { errors: clientAssertionSignatureErrors } =
        await verifyClientAssertionSignature(
          body.client_assertion,
          key,
          clientAssertionJWT.header.alg
        );

      if (clientAssertionSignatureErrors) {
        throw clientAssertionSignatureValidationFailed(
          body.client_id,
          clientAssertionSignatureErrors.map((error) => error.detail).join(", ")
        );
      }

      // Platform states validation
      const { errors: platformStateErrors } =
        validateClientKindAndPlatformState(key, clientAssertionJWT);
      if (platformStateErrors) {
        throw platformStateValidationFailed(
          platformStateErrors.map((error) => error.detail).join(", ")
        );
      }

      // Rate limit check
      const { limitReached, ...rateLimiterStatus } =
        await redisRateLimiter.rateLimitByOrganization(
          key.consumerId,
          getCtx().logger
        );
      if (limitReached) {
        return {
          limitReached: true,
          token: undefined,
          rateLimitedTenantId: key.consumerId,
          rateLimiterStatus,
          isDPoP: dpopProofJWT !== undefined,
        };
      }

      // Check if the cache contains the DPoP proof
      if (dpopProofJWT) {
        const { errors: dpopCacheErrors } = await checkDPoPCache({
          dynamoDBClient,
          dpopProofJti: dpopProofJWT.payload.jti,
          dpopProofIat: dpopProofJWT.payload.iat,
          dpopCacheTable: config.dpopCacheTable,
          dpopProofDurationSeconds: config.dpopDurationSeconds,
        });
        if (dpopCacheErrors) {
          throw dpopProofJtiAlreadyUsed(dpopProofJWT.payload.jti);
        }
      }

      return await match(key)
        .with(
          { clientKind: clientKindTokenGenStates.consumer },
          async (key) => {
            const { eserviceId, descriptorId } =
              deconstructGSIPK_eserviceId_descriptorId(
                key.GSIPK_eserviceId_descriptorId
              );

            const token = await tokenGenerator.generateInteropConsumerToken({
              sub: clientAssertionJWT.payload.sub,
              audience: key.descriptorAudience,
              purposeId: key.GSIPK_purposeId,
              tokenDurationInSeconds: key.descriptorVoucherLifespan,
              digest: clientAssertionJWT.payload.digest || undefined,
              producerId: key.producerId,
              consumerId: key.consumerId,
              eserviceId,
              descriptorId,
              featureFlagImprovedProducerVerificationClaims:
                isFeatureFlagEnabled(
                  config,
                  "featureFlagImprovedProducerVerificationClaims"
                ),
              dpopJWK: dpopProofJWT?.header.jwk,
            });

            await publishAudit({
              producer,
              generatedToken: token,
              key,
              clientAssertion: clientAssertionJWT,
              dpop: dpopProofJWT,
              correlationId: getCtx().correlationId,
              fileManager,
              logger: getCtx().logger,
            });

            logTokenGenerationInfo({
              validatedJwt: clientAssertionJWT,
              clientKind: key.clientKind,
              tokenJti: token.payload.jti,
              message: "Token generated",
              logger: getCtx().logger,
            });

            return {
              limitReached: false as const,
              token,
              rateLimiterStatus,
              isDPoP: dpopProofJWT !== undefined,
            };
          }
        )
        .with({ clientKind: clientKindTokenGenStates.api }, async (key) => {
          const token = await tokenGenerator.generateInteropApiToken({
            sub: clientAssertionJWT.payload.sub,
            consumerId: key.consumerId,
            clientAdminId: key.adminId,
            // Pass JWK directly (can be undefined).
            // generateInteropApiToken handles conditional 'cnf' inclusion.
            dpopJWK: dpopProofJWT?.header.jwk,
          });

          logTokenGenerationInfo({
            validatedJwt: clientAssertionJWT,
            clientKind: key.clientKind,
            tokenJti: token.payload.jti,
            message: "Token generated",
            logger: getCtx().logger,
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

export type TokenService = ReturnType<typeof tokenServiceBuilder>;

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

const publishAudit = async ({
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
  generatedToken: InteropConsumerToken;
  key: FullTokenGenerationStatesConsumerClient;
  clientAssertion: ClientAssertion;
  dpop: DPoPProof | undefined;
  correlationId: CorrelationId;
  fileManager: FileManager;
  logger: Logger;
}): Promise<void> => {
  const { eserviceId, descriptorId } = deconstructGSIPK_eserviceId_descriptorId(
    key.GSIPK_eserviceId_descriptorId
  );
  const messageBody: GeneratedTokenAuditDetails = {
    jwtId: generatedToken.payload.jti,
    correlationId,
    issuedAt: secondsToMilliseconds(generatedToken.payload.iat),
    clientId: clientAssertion.payload.sub,
    organizationId: key.consumerId,
    agreementId: key.agreementId,
    eserviceId,
    descriptorId,
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
    logger.error("Main auditing flow failed, going through fallback");
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

const logTokenGenerationInfo = ({
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

const validateDPoPProof = async (
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
