import { IncomingHttpHeaders } from "http";
import {
  validateRequestParameters,
  verifyAsyncClientAssertion,
} from "pagopa-interop-client-assertion-validation";
import { authorizationServerApi } from "pagopa-interop-api-clients";
import {
  AsyncClientAssertion,
  ClientId,
  ClientKindTokenGenStates,
  CorrelationId,
  DPoPProof,
  FullTokenGenerationStatesConsumerClient,
  InteractionState,
  interactionState,
  TenantId,
  TokenGenerationStatesApiClient,
} from "pagopa-interop-models";
import {
  AuthServerAppContext,
  FileManager,
  InteropAsyncConsumerToken,
  InteropApiToken,
  InteropConsumerToken,
  InteropTokenGenerator,
  Logger,
  RateLimiter,
  RateLimiterStatus,
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
  clientAssertionValidationFailed,
  dpopProofJtiAlreadyUsed,
} from "../model/domain/errors.js";
import { HttpDPoPHeader } from "../model/domain/models.js";
import {
  logTokenGenerationInfo,
  validateDPoPProof,
} from "../utilities/tokenServiceHelpers.js";
import { handleStartInteraction } from "./scopeHandlers/startInteractionHandler.js";

export type ScopeHandlerContext = {
  dynamoDBClient: DynamoDBClient;
  redisRateLimiter: RateLimiter;
  producer: Awaited<ReturnType<typeof initProducer>>;
  fileManager: FileManager;
  clientAssertionJWT: AsyncClientAssertion;
  clientAssertionJWS: string;
  correlationId: CorrelationId;
  logger: Logger;
  dpopProofJWT: DPoPProof | undefined;
  setCtxOrganizationId: (organizationId: TenantId) => void;
  setCtxClientKind: (tokenGenClientKind: ClientKindTokenGenStates) => void;
  tokenGenerator: InteropTokenGenerator;
  platformStatesTable: string;
  interactionsTable: string;
  interactionTtlEpsilonSeconds: number;
};

export type AsyncGeneratedTokenData =
  | {
      limitReached: true;
      rateLimitedTenantId: TenantId;
      rateLimiterStatus: Omit<RateLimiterStatus, "limitReached">;
    }
  | {
      limitReached: false;
      rateLimiterStatus: Omit<RateLimiterStatus, "limitReached">;
      tokenGenerated: false;
    }
  | {
      limitReached: false;
      rateLimiterStatus: Omit<RateLimiterStatus, "limitReached">;
      tokenGenerated: true;
      token: InteropConsumerToken | InteropAsyncConsumerToken;
      key: FullTokenGenerationStatesConsumerClient;
      isDPoP: boolean;
    }
  | {
      limitReached: false;
      rateLimiterStatus: Omit<RateLimiterStatus, "limitReached">;
      tokenGenerated: true;
      token: InteropApiToken;
      key: TokenGenerationStatesApiClient;
      isDPoP: boolean;
    };

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function asyncTokenServiceBuilder({
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
    async generateAsyncToken(
      headers: IncomingHttpHeaders & HttpDPoPHeader,
      body: authorizationServerApi.AccessTokenRequest,
      getCtx: () => WithLogger<AuthServerAppContext>,
      setCtxClientId: (clientId: ClientId) => void,
      setCtxClientKind: (tokenGenClientKind: ClientKindTokenGenStates) => void,
      setCtxOrganizationId: (organizationId: TenantId) => void
    ): Promise<AsyncGeneratedTokenData> {
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
          getCtx().logger
        );

      if (clientAssertionErrors) {
        throw clientAssertionValidationFailed(
          body.client_id,
          clientAssertionErrors.map((error) => error.detail).join(", ")
        );
      }

      const clientId = clientAssertionJWT.payload.sub;
      const scope = clientAssertionJWT.payload.scope;

      setCtxClientId(clientId);

      logTokenGenerationInfo({
        validatedJwt: clientAssertionJWT,
        clientKind: undefined,
        tokenJti: undefined,
        message: "Client assertion validated",
        logger: getCtx().logger,
      });

      // DPoP cache check (does not depend on key retrieval)
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

      // Dispatch by async scope.
      // Key retrieval, signature verification, platform state validation,
      // rate limiting, token generation, and audit are scope-dependent
      // (e.g. callback_invocation uses producer keychain, not token-generation-states).
      return await generateAsyncTokenByScope(scope, {
        dynamoDBClient,
        redisRateLimiter,
        producer,
        fileManager,
        clientAssertionJWT,
        clientAssertionJWS: body.client_assertion,
        correlationId: getCtx().correlationId,
        logger: getCtx().logger,
        dpopProofJWT,
        setCtxOrganizationId,
        setCtxClientKind,
        tokenGenerator,
        platformStatesTable: config.platformStatesTable,
        interactionsTable: config.interactionsTable,
        interactionTtlEpsilonSeconds: config.interactionTtlEpsilonSeconds,
      });
    },
  };
}

export type AsyncTokenService = ReturnType<typeof asyncTokenServiceBuilder>;

const generateAsyncTokenByScope = async (
  scope: InteractionState,
  ctx: ScopeHandlerContext
): Promise<AsyncGeneratedTokenData> =>
  match(scope)
    .with(interactionState.startInteraction, async () =>
      handleStartInteraction(ctx)
    )
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
