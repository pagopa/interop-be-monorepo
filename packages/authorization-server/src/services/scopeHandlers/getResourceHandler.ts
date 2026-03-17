import { verifyClientAssertionSignature } from "pagopa-interop-client-assertion-validation";
import {
  clientKindTokenGenStates,
  genericInternalError,
  makeTokenGenerationStatesClientKidPurposePK,
} from "pagopa-interop-models";
import {
  callbackInvocationTokenIssuedAtMissing,
  clientAssertionSignatureValidationFailed,
  interactionIdNotProvided,
  interactionNotFound,
  interactionStateNotAllowed,
} from "../../model/domain/errors.js";
import {
  logTokenGenerationInfo,
  publishAudit,
  retrieveKey,
} from "../../utilities/tokenServiceHelpers.js";
import {
  readInteraction,
  isInteractionStateAllowedForScope,
  updateInteractionState,
} from "../../utilities/interactionsUtils.js";
import type {
  AsyncGeneratedTokenData,
  ScopeHandlerContext,
} from "../asyncTokenService.js";

export const handleGetResource = async (
  scope: "get_resource",
  ctx: ScopeHandlerContext
): Promise<AsyncGeneratedTokenData> => {
  const {
    clientAssertionJWT,
    clientAssertionJWS,
    dynamoDBClient,
    redisRateLimiter,
    producer,
    fileManager,
    correlationId,
    logger,
    dpopProofJWT,
    setCtxOrganizationId,
    setCtxClientKind,
    tokenGenerator,
    interactionsTable,
  } = ctx;

  const clientId = clientAssertionJWT.payload.sub;

  // 1. Validate get_resource-specific claims
  const interactionId = clientAssertionJWT.payload.interactionId;
  if (!interactionId) {
    throw interactionIdNotProvided(clientId);
  }

  // 2. Read interaction by interactionId
  const interaction = await readInteraction(
    dynamoDBClient,
    interactionId,
    interactionsTable
  );
  if (!interaction) {
    throw interactionNotFound(interactionId);
  }

  // 3. Validate interaction state transition
  if (
    !isInteractionStateAllowedForScope({
      currentState: interaction.state,
      scope,
    })
  ) {
    throw interactionStateNotAllowed(interactionId, interaction.state, scope);
  }

  // 4. Validate callbackInvocationTokenIssuedAt is present
  if (!interaction.callbackInvocationTokenIssuedAt) {
    throw callbackInvocationTokenIssuedAtMissing(interactionId);
  }

  // 5. TODO: Validate asyncExchangeResourceAvailableTime once it's propagated to platform-states catalog entry
  // Algorithm: Date.now() - Date.parse(interaction.callbackInvocationTokenIssuedAt) < catalogEntry.asyncExchangeResourceAvailableTime

  // 6. Retrieve consumer key from token-generation-states using interaction's purposeId
  // This implicitly validates that the consumer is authorized for this interaction's purpose
  const kid = clientAssertionJWT.header.kid;
  const pk = makeTokenGenerationStatesClientKidPurposePK({
    clientId,
    kid,
    purposeId: interaction.purposeId,
  });
  const key = await retrieveKey(dynamoDBClient, pk);

  // 7. Validate consumer client kind
  if (key.clientKind !== clientKindTokenGenStates.consumer) {
    throw genericInternalError(
      `Expected consumer client kind for get_resource, got ${key.clientKind}`
    );
  }

  setCtxOrganizationId(key.consumerId);
  setCtxClientKind(key.clientKind);

  // 8. Verify client assertion signature
  const { errors: signatureErrors } = await verifyClientAssertionSignature(
    clientAssertionJWS,
    key,
    clientAssertionJWT.header.alg
  );
  if (signatureErrors) {
    throw clientAssertionSignatureValidationFailed(
      clientId,
      signatureErrors.map((error) => error.detail).join(", ")
    );
  }

  // 9. Rate limiting
  const { limitReached, ...rateLimiterStatus } =
    await redisRateLimiter.rateLimitByOrganization(key.consumerId, logger);
  if (limitReached) {
    return {
      limitReached: true as const,
      rateLimitedTenantId: key.consumerId,
      rateLimiterStatus,
    };
  }

  // 10. Update interaction state + Generate token in parallel
  const issuedAt = new Date().toISOString();

  const [, token] = await Promise.all([
    updateInteractionState({
      dynamoDBClient,
      interactionsTable,
      interactionId,
      state: scope,
      updatedAt: issuedAt,
    }),
    tokenGenerator.generateInteropAsyncConsumerToken({
      sub: clientId,
      audience: key.descriptorAudience,
      purposeId: interaction.purposeId,
      tokenDurationInSeconds: key.descriptorVoucherLifespan,
      interactionId,
      urlCallback: undefined,
      scope,
      dpopJWK: dpopProofJWT?.header.jwk,
    }),
  ]);

  // 11. Publish audit
  await publishAudit({
    producer,
    generatedToken: token,
    key,
    clientAssertion: clientAssertionJWT,
    dpop: dpopProofJWT,
    correlationId,
    fileManager,
    logger,
  });

  // 12. Log and return
  logTokenGenerationInfo({
    validatedJwt: clientAssertionJWT,
    clientKind: key.clientKind,
    tokenJti: token.payload.jti,
    message: "Async token generated (get_resource)",
    logger,
  });

  return {
    limitReached: false as const,
    rateLimiterStatus,
    tokenGenerated: true as const,
    token,
    key,
    isDPoP: dpopProofJWT !== undefined,
  };
};
