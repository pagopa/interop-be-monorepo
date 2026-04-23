import {
  validateAsyncClaimsForScope,
  validatePlatformState,
  verifyClientAssertionSignature,
} from "pagopa-interop-client-assertion-validation";
import {
  clientKindTokenGenStates,
  genericInternalError,
  interactionState,
  makeTokenGenerationStatesClientKidPurposePK,
} from "pagopa-interop-models";
import {
  asyncClientAssertionClaimsValidationFailed,
  asyncExchangeConfirmationNotEnabled,
  asyncExchangeNotEnabled,
  callbackInvocationTokenIssuedAtMissing,
  clientAssertionSignatureValidationFailed,
  interactionClientMismatch,
  interactionNotFound,
  interactionStateNotAllowed,
  platformStateValidationFailed,
  resourceAvailableTimeExpired,
} from "../../model/domain/errors.js";
import {
  logTokenGenerationInfo,
  publishAudit,
  retrieveAsyncCatalogEntry,
  retrieveKey,
} from "../../utilities/tokenServiceHelpers.js";
import {
  isInteractionStateAllowedForScope,
  readInteraction,
  updateInteractionState,
} from "../../utilities/interactionsUtils.js";
import type {
  AsyncGeneratedTokenData,
  ScopeHandlerContext,
} from "../asyncTokenService.js";

export const handleConfirmation = async (
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
    platformStatesTable,
  } = ctx;

  const clientId = clientAssertionJWT.payload.sub;

  // 1. Validate confirmation-specific claims (interactionId).
  const { errors: claimErrors } = validateAsyncClaimsForScope(
    clientAssertionJWT.payload,
    interactionState.confirmation
  );
  if (claimErrors) {
    throw asyncClientAssertionClaimsValidationFailed(
      clientId,
      claimErrors.map((error) => error.detail).join(", ")
    );
  }
  const { interactionId } = clientAssertionJWT.payload;
  if (!interactionId) {
    throw genericInternalError(
      "interactionId missing after async claim validation"
    );
  }

  // 2. Read interaction and validate state transition
  const interaction = await readInteraction(
    dynamoDBClient,
    interactionId,
    interactionsTable
  );
  if (!interaction) {
    throw interactionNotFound(interactionId);
  }
  if (
    !isInteractionStateAllowedForScope({
      currentState: interaction.state,
      scope: interactionState.confirmation,
    })
  ) {
    throw interactionStateNotAllowed(
      interactionId,
      interaction.state,
      interactionState.confirmation
    );
  }

  // 3. The caller must be the same client that started the interaction:
  //    a different client on the same tenant that knows the interactionId
  //    must not be able to pick up tokens for an exchange it did not start.
  if (interaction.clientId !== clientId) {
    throw interactionClientMismatch(interactionId);
  }

  // 4. The resource-available window is measured from the callback_invocation
  //    timestamp; the transition guard above ensures the interaction has passed
  //    through callback_invocation, so this field must be present.
  if (!interaction.callbackInvocationTokenIssuedAt) {
    throw callbackInvocationTokenIssuedAtMissing(interactionId);
  }

  // 5. eserviceId/descriptorId come from the interaction (pinned at
  //    start_interaction) — not from the current token-generation-states row,
  //    which the platform-state writers may rewrite with a different
  //    descriptor if agreement/descriptor data becomes outdated.
  const { eServiceId: eserviceId, descriptorId } = interaction;

  // 6. Retrieve consumer key and async catalog entry in parallel.
  const kid = clientAssertionJWT.header.kid;
  const pk = makeTokenGenerationStatesClientKidPurposePK({
    clientId,
    kid,
    purposeId: interaction.purposeId,
  });
  const [key, catalogEntry] = await Promise.all([
    retrieveKey(dynamoDBClient, pk),
    retrieveAsyncCatalogEntry(
      dynamoDBClient,
      eserviceId,
      descriptorId,
      platformStatesTable
    ),
  ]);

  if (key.clientKind !== clientKindTokenGenStates.consumer) {
    throw genericInternalError(
      `Expected consumer client kind for confirmation, got ${key.clientKind}`
    );
  }

  setCtxOrganizationId(key.consumerId);
  setCtxClientKind(key.clientKind);

  if (key.asyncExchange !== true) {
    throw asyncExchangeNotEnabled(clientId);
  }

  const { asyncExchangeProperties } = catalogEntry;

  // 7. Confirmation must be explicitly enabled on the eService's async properties
  if (asyncExchangeProperties.confirmation !== true) {
    throw asyncExchangeConfirmationNotEnabled(interactionId);
  }

  // 7. Verify client assertion signature
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

  // 8. Validate platform state (agreement, purpose, descriptor must be ACTIVE)
  const { errors: platformStateErrors } = validatePlatformState(key);
  if (platformStateErrors) {
    throw platformStateValidationFailed(
      platformStateErrors.map((error) => error.detail).join(", ")
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

  // 10. Generate token first, then update interaction state.
  //     Check the resource-available-time window here so the elapsed
  //     measurement and the token's iat share the same reference instant.
  const now = new Date();
  const elapsedMs =
    now.getTime() - Date.parse(interaction.callbackInvocationTokenIssuedAt);
  const resourceAvailableTimeLimitMs =
    asyncExchangeProperties.resourceAvailableTime * 1000;
  if (elapsedMs >= resourceAvailableTimeLimitMs) {
    throw resourceAvailableTimeExpired(
      interactionId,
      elapsedMs,
      resourceAvailableTimeLimitMs
    );
  }

  const token = await tokenGenerator.generateInteropAsyncConsumerToken({
    sub: clientId,
    audience: key.descriptorAudience,
    purposeId: interaction.purposeId,
    tokenDurationInSeconds: key.descriptorVoucherLifespan,
    digest: clientAssertionJWT.payload.digest || undefined,
    producerId: key.producerId,
    consumerId: key.consumerId,
    eserviceId,
    descriptorId,
    interactionId,
    scope: interactionState.confirmation,
    dpopJWK: dpopProofJWT?.header.jwk,
    now,
  });

  await updateInteractionState({
    dynamoDBClient,
    interactionsTable,
    interactionId,
    state: interactionState.confirmation,
    updatedAt: new Date(token.payload.iat * 1000).toISOString(),
  });

  // 11. Publish audit (consumer-side)
  await publishAudit({
    producer,
    generatedToken: token,
    key,
    eserviceId,
    descriptorId,
    clientAssertion: clientAssertionJWT,
    dpop: dpopProofJWT,
    correlationId,
    fileManager,
    logger,
  });

  logTokenGenerationInfo({
    validatedJwt: clientAssertionJWT,
    clientKind: key.clientKind,
    tokenJti: token.payload.jti,
    message: "Async token generated (confirmation)",
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
