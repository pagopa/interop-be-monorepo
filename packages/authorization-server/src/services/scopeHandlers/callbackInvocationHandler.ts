import {
  clientKindTokenGenStates,
  genericInternalError,
  interactionState,
  unsafeBrandId,
  ProducerKeychainId,
} from "pagopa-interop-models";
import {
  validateAsyncClaimsForScope,
  validatePlatformState,
  verifyClientAssertionSignature,
} from "pagopa-interop-client-assertion-validation";
import {
  asyncClientAssertionClaimsValidationFailed,
  clientAssertionSignatureValidationFailed,
  interactionNotFound,
  interactionStateNotAllowed,
  platformStateValidationFailed,
  asyncExchangeResponseTimeExceeded,
  entityNumberExceedsMaxResultSet,
} from "../../model/domain/errors.js";
import {
  logTokenGenerationInfo,
  publishProducerAudit,
  retrieveAsyncCatalogEntry,
  retrieveProducerKey,
  retrieveTokenGenStatesEntryByPurposeId,
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

export const handleCallbackInvocation = async (
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
    tokenGenerationStatesTable,
    producerKeychainPlatformStatesTable,
  } = ctx;

  // In callback_invocation the JWT is signed with the producer keychain, so
  // `sub` is the producerKeychainId. We keep the `clientId` name for error
  // messages that reference the caller's identity as presented in the JWT.
  const clientId = clientAssertionJWT.payload.sub;

  // 1. Validate callback_invocation-specific claims (aggregates all missing/invalid
  //    claims into a single asyncClientAssertionClaimsValidationFailed error).
  const { errors: claimErrors } = validateAsyncClaimsForScope(
    clientAssertionJWT.payload,
    interactionState.callbackInvocation
  );
  if (claimErrors) {
    throw asyncClientAssertionClaimsValidationFailed(
      clientId,
      claimErrors.map((error) => error.detail).join(", ")
    );
  }
  // validateAsyncClaimsForScope guarantees these are defined for this scope,
  // but the Zod schema keeps them optional; re-check as a type guard.
  const { interactionId, entityNumber } = clientAssertionJWT.payload;
  if (!interactionId || entityNumber === undefined || entityNumber === null) {
    throw genericInternalError(
      "interactionId or entityNumber missing after async claim validation"
    );
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
      scope: interactionState.callbackInvocation,
    })
  ) {
    throw interactionStateNotAllowed(
      interactionId,
      interaction.state,
      interactionState.callbackInvocation
    );
  }

  // 4. Extract eServiceId and descriptorId from interaction
  const { eServiceId, descriptorId } = interaction;

  // 5. Retrieve producer key, catalog entry and token-generation-states entry (by purposeId) in parallel
  const kid = clientAssertionJWT.header.kid;
  const producerKeychainId = unsafeBrandId<ProducerKeychainId>(clientId);
  const [producerKey, catalogEntry, tokenGenStatesEntry] = await Promise.all([
    retrieveProducerKey(dynamoDBClient, producerKeychainPlatformStatesTable, {
      producerKeychainId,
      kid,
      eServiceId,
    }),
    retrieveAsyncCatalogEntry(
      dynamoDBClient,
      eServiceId,
      descriptorId,
      platformStatesTable
    ),
    retrieveTokenGenStatesEntryByPurposeId(
      dynamoDBClient,
      interaction.purposeId,
      tokenGenerationStatesTable
    ),
  ]);

  // 6. Verify client assertion signature
  const { errors: signatureErrors } = await verifyClientAssertionSignature(
    clientAssertionJWS,
    { publicKey: producerKey.publicKey },
    clientAssertionJWT.header.alg
  );
  if (signatureErrors) {
    throw clientAssertionSignatureValidationFailed(
      clientId,
      signatureErrors.map((error) => error.detail).join(", ")
    );
  }

  // 7. Validate platform state (agreement, purpose and descriptor must be ACTIVE)
  //    Same semantics as start_interaction: read pre-computed states from
  //    token-generation-states and aggregate errors into platformStateValidationFailed.
  const { errors: platformStateErrors } =
    validatePlatformState(tokenGenStatesEntry);
  if (platformStateErrors) {
    throw platformStateValidationFailed(
      platformStateErrors.map((error) => error.detail).join(", ")
    );
  }

  // 8. Validate maxResultSet against asyncExchangeProperties (the responseTime
  //    check is deferred to step 10 so the elapsed window is measured as close
  //    as possible to the token's iat).
  if (!interaction.startInteractionTokenIssuedAt) {
    throw genericInternalError(
      `Interaction ${interactionId} missing startInteractionTokenIssuedAt`
    );
  }

  const { asyncExchangeProperties } = catalogEntry;
  if (entityNumber > asyncExchangeProperties.maxResultSet) {
    throw entityNumberExceedsMaxResultSet(
      clientId,
      entityNumber,
      asyncExchangeProperties.maxResultSet
    );
  }

  // 9. Rate limiting
  setCtxOrganizationId(producerKey.producerId);
  // clientKindTokenGenStates only has CONSUMER and API — no PRODUCER kind exists.
  // CONSUMER is used here for rate-limit and observability context.
  setCtxClientKind(clientKindTokenGenStates.consumer);
  const { limitReached, ...rateLimiterStatus } =
    await redisRateLimiter.rateLimitByOrganization(
      producerKey.producerId,
      logger
    );
  if (limitReached) {
    return {
      limitReached: true as const,
      rateLimitedTenantId: producerKey.producerId,
      rateLimiterStatus,
    };
  }

  // 10. Generate token first, then update interaction state.
  //     These must be sequential: if token generation fails we must not
  //     persist a state transition for a token that was never delivered.
  //     Check the response-time window here (not earlier) so the elapsed
  //     measurement and the token's iat share the same reference instant.
  const now = new Date();
  const elapsedMs =
    now.getTime() - Date.parse(interaction.startInteractionTokenIssuedAt);
  const responseTimeLimitMs = asyncExchangeProperties.responseTime * 1000;
  if (elapsedMs >= responseTimeLimitMs) {
    throw asyncExchangeResponseTimeExceeded(
      interactionId,
      elapsedMs,
      responseTimeLimitMs
    );
  }

  const issuedAt = now.toISOString();

  const token = await tokenGenerator.generateInteropAsyncConsumerToken({
    sub: clientId,
    audience: catalogEntry.descriptorAudience,
    purposeId: interaction.purposeId,
    tokenDurationInSeconds: catalogEntry.descriptorVoucherLifespan,
    digest: clientAssertionJWT.payload.digest || undefined,
    producerId: producerKey.producerId,
    consumerId: interaction.consumerId,
    eserviceId: eServiceId,
    descriptorId,
    interactionId,
    scope: interactionState.callbackInvocation,
    dpopJWK: dpopProofJWT?.header.jwk,
  });

  await updateInteractionState({
    dynamoDBClient,
    interactionsTable,
    interactionId,
    state: interactionState.callbackInvocation,
    updatedAt: issuedAt,
  });

  // 11. Publish audit
  const { agreementId, purposeVersionId } = tokenGenStatesEntry;
  if (!agreementId || !purposeVersionId) {
    throw genericInternalError(
      `Token-generation-states entry for purpose ${interaction.purposeId} is missing agreementId or purposeVersionId`
    );
  }
  await publishProducerAudit({
    producer,
    generatedToken: token,
    organizationId: producerKey.producerId,
    agreementId,
    eserviceId: eServiceId,
    descriptorId,
    purposeId: interaction.purposeId,
    purposeVersionId,
    clientAssertion: clientAssertionJWT,
    dpop: dpopProofJWT,
    correlationId,
    fileManager,
    logger,
  });

  // 12. Log and return
  logTokenGenerationInfo({
    validatedJwt: clientAssertionJWT,
    clientKind: undefined,
    tokenJti: token.payload.jti,
    message: "Async token generated (callback_invocation)",
    logger,
  });

  return {
    limitReached: false as const,
    rateLimiterStatus,
    tokenGenerated: true as const,
    token,
    isDPoP: dpopProofJWT !== undefined,
  };
};
