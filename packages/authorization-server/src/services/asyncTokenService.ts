import { IncomingHttpHeaders } from "http";
import {
  validateClientKindAndPlatformState,
  validateRequestParameters,
  verifyAsyncClientAssertion,
  verifyClientAssertionSignature,
} from "pagopa-interop-client-assertion-validation";
import { authorizationServerApi } from "pagopa-interop-api-clients";
import {
  AsyncClientAssertion,
  ClientId,
  ClientKindTokenGenStates,
  clientKindTokenGenStates,
  CorrelationId,
  DPoPProof,
  FullTokenGenerationStatesConsumerClient,
  InteractionState,
  interactionState,
  makeTokenGenerationStatesClientKidPK,
  makeTokenGenerationStatesClientKidPurposePK,
  TenantId,
  TokenGenerationStatesApiClient,
  tooManyRequestsError,
} from "pagopa-interop-models";
import {
  AuthServerAppContext,
  FileManager,
  InteropApiToken,
  InteropConsumerToken,
  isFeatureFlagEnabled,
  Logger,
  RateLimiter,
  WithLogger,
} from "pagopa-interop-commons";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { initProducer } from "kafka-iam-auth";
import { match } from "ts-pattern";
import { config } from "../config/config.js";
import { checkDPoPCache } from "pagopa-interop-dpop-validation";
import {
  asyncRequestValidationFailed,
  asyncScopeNotYetImplemented,
  clientAssertionSignatureValidationFailed,
  clientAssertionValidationFailed,
  dpopProofJtiAlreadyUsed,
  platformStateValidationFailed,
} from "../model/domain/errors.js";
import { HttpDPoPHeader } from "../model/domain/models.js";
import {
  logTokenGenerationInfo,
  publishAudit,
  retrieveKey,
  validateDPoPProof,
} from "./tokenService.js";

type ScopeHandlerContext = {
  key: FullTokenGenerationStatesConsumerClient | TokenGenerationStatesApiClient;
  clientAssertionJWT: AsyncClientAssertion;
  correlationId: CorrelationId;
  logger: Logger;
  dpopProofJWT: DPoPProof | undefined;
};

export type ScopeHandlerResult =
  | { tokenGenerated: false }
  | {
      tokenGenerated: true;
      token: InteropConsumerToken;
      key: FullTokenGenerationStatesConsumerClient;
    }
  | {
      tokenGenerated: true;
      token: InteropApiToken;
      key: TokenGenerationStatesApiClient;
    };

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function asyncTokenServiceBuilder({
  dynamoDBClient,
  redisRateLimiter,
  producer,
  fileManager,
}: {
  dynamoDBClient: DynamoDBClient;
  redisRateLimiter: RateLimiter;
  producer: Awaited<ReturnType<typeof initProducer>>;
  fileManager: FileManager;
}) {
  return {
    // eslint-disable-next-line max-params
    async generateAsyncToken(
      headers: IncomingHttpHeaders & HttpDPoPHeader,
      body: authorizationServerApi.AsyncAccessTokenRequest,
      getCtx: () => WithLogger<AuthServerAppContext>,
      setCtxClientId: (clientId: ClientId) => void,
      setCtxClientKind: (tokenGenClientKind: ClientKindTokenGenStates) => void,
      setCtxOrganizationId: (organizationId: TenantId) => void
    ): Promise<ScopeHandlerResult> {
      getCtx().logger.info(
        `[CLIENTID=${body.client_id}] Async token requested`
      );

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
        throw asyncRequestValidationFailed(
          body.client_id,
          parametersErrors.map((error) => error.detail).join(", ")
        );
      }

      // Client assertion validation (with async-specific claims)
      const { data: clientAssertionJWT, errors: clientAssertionErrors } =
        verifyAsyncClientAssertion(
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
      const scope = clientAssertionJWT.payload.scope;

      setCtxClientId(clientId);

      logTokenGenerationInfo({
        validatedJwt: clientAssertionJWT,
        clientKind: undefined,
        tokenJti: undefined,
        message: "Client assertion validated",
        logger: getCtx().logger,
      });

      // Client assertion signature verification
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
      const { limitReached } = await redisRateLimiter.rateLimitByOrganization(
        key.consumerId,
        getCtx().logger
      );
      if (limitReached) {
        throw tooManyRequestsError(key.consumerId);
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

      // Dispatch by async scope
      const result = await generateTokenByScope(scope, {
        key,
        clientAssertionJWT,
        correlationId: getCtx().correlationId,
        logger: getCtx().logger,
        dpopProofJWT,
      });

      // Audit publishing + final logging
      if (result.tokenGenerated) {
        await match(result)
          .with(
            { key: { clientKind: clientKindTokenGenStates.consumer } },
            async (consumerResult) => {
              await publishAudit({
                producer,
                generatedToken: consumerResult.token,
                key: consumerResult.key,
                clientAssertion: clientAssertionJWT,
                dpop: dpopProofJWT,
                correlationId: getCtx().correlationId,
                fileManager,
                logger: getCtx().logger,
              });
            }
          )
          .otherwise(() => Promise.resolve());

        logTokenGenerationInfo({
          validatedJwt: clientAssertionJWT,
          clientKind: key.clientKind,
          tokenJti: result.token.payload.jti,
          message: "Async token generated",
          logger: getCtx().logger,
        });
      }

      return result;
    },
  };
}

export type AsyncTokenService = ReturnType<typeof asyncTokenServiceBuilder>;

const generateTokenByScope = async (
  scope: InteractionState,
  _ctx: ScopeHandlerContext
): Promise<ScopeHandlerResult> =>
  match(scope)
    .with(interactionState.startInteraction, async () => {
      throw asyncScopeNotYetImplemented(interactionState.startInteraction);
    })
    .with(interactionState.callbackInvocation, async () => {
      throw asyncScopeNotYetImplemented(interactionState.callbackInvocation);
    })
    .with(interactionState.getResource, async () => {
      throw asyncScopeNotYetImplemented(interactionState.getResource);
    })
    .with(interactionState.confirmation, async () => {
      throw asyncScopeNotYetImplemented(interactionState.confirmation);
    })
    .exhaustive();
