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
  makeTokenGenerationStatesClientKidPK,
  makeTokenGenerationStatesClientKidPurposePK,
  TenantId,
  ClientKindTokenGenStates,
  ClientId,
  unsafeBrandId,
} from "pagopa-interop-models";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { match } from "ts-pattern";
import {
  AuthServerAppContext,
  FileManager,
  InteropApiToken,
  InteropConsumerToken,
  InteropTokenGenerator,
  isFeatureFlagEnabled,
  RateLimiter,
  RateLimiterStatus,
  WithLogger,
} from "pagopa-interop-commons";
import { initProducer } from "kafka-iam-auth";
import { checkDPoPCache } from "pagopa-interop-dpop-validation";
import { config } from "../config/config.js";
import {
  clientAssertionRequestValidationFailed,
  clientAssertionSignatureValidationFailed,
  clientAssertionValidationFailed,
  platformStateValidationFailed,
  dpopProofJtiAlreadyUsed,
} from "../model/domain/errors.js";
import { HttpDPoPHeader } from "../model/domain/models.js";
import {
  deconstructGSIPK_eserviceId_descriptorId,
  logTokenGenerationInfo,
  publishAudit,
  retrieveKey,
  validateDPoPProof,
} from "../utilities/tokenServiceHelpers.js";

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
              eserviceId,
              descriptorId,
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
            isDPoP: dpopProofJWT !== undefined,
          };
        })
        .exhaustive();
    },
  };
}

export type TokenService = ReturnType<typeof tokenServiceBuilder>;
