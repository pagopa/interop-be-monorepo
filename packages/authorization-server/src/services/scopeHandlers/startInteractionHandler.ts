import {
  validateAsyncClaimsForScope,
  validatePlatformState,
  verifyClientAssertionSignature,
} from "pagopa-interop-client-assertion-validation";
import {
  clientKindTokenGenStates,
  generateId,
  genericInternalError,
  InteractionId,
  interactionState,
  makeTokenGenerationStatesClientKidPurposePK,
} from "pagopa-interop-models";
import {
  asyncClientAssertionClaimsValidationFailed,
  asyncExchangeNotEnabled,
  clientAssertionSignatureValidationFailed,
  platformStateValidationFailed,
} from "../../model/domain/errors.js";
import {
  deconstructGSIPK_eserviceId_descriptorId,
  logTokenGenerationInfo,
  publishAudit,
  retrieveCatalogEntry,
  retrieveKey,
} from "../../utilities/tokenServiceHelpers.js";
import { createInteraction } from "../../utilities/interactionsUtils.js";
import type {
  AsyncGeneratedTokenData,
  ScopeHandlerContext,
} from "../asyncTokenService.js";

export const handleStartInteraction = async (
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
    platformStatesTable,
    interactionsTable,
    interactionTtlEpsilonSeconds,
  } = ctx;

  // 1. Validate start_interaction-specific claims (aggregates all missing/invalid
  //    claims into a single asyncClientAssertionClaimsValidationFailed error).
  const clientId = clientAssertionJWT.payload.sub;
  const { errors: claimErrors } = validateAsyncClaimsForScope(
    clientAssertionJWT.payload,
    interactionState.startInteraction
  );
  if (claimErrors) {
    throw asyncClientAssertionClaimsValidationFailed(
      clientId,
      claimErrors.map((error) => error.detail).join(", ")
    );
  }
  // validateAsyncClaimsForScope guarantees these are defined for this scope,
  // but the Zod schema keeps them optional; re-check as a type guard.
  const { urlCallback, purposeId } = clientAssertionJWT.payload;
  if (!urlCallback || !purposeId) {
    throw genericInternalError(
      "urlCallback or purposeId missing after async claim validation"
    );
  }

  // 2. Retrieve key from token-generation-states (consumer key with purposeId)
  const kid = clientAssertionJWT.header.kid;
  const pk = makeTokenGenerationStatesClientKidPurposePK({
    clientId,
    kid,
    purposeId,
  });
  const key = await retrieveKey(dynamoDBClient, pk);

  if (key.clientKind !== clientKindTokenGenStates.consumer) {
    throw genericInternalError(
      `Expected consumer client kind for start_interaction, got ${key.clientKind}`
    );
  }

  setCtxOrganizationId(key.consumerId);
  setCtxClientKind(key.clientKind);

  // 3. Validate that the eService supports async exchange (cheap check before crypto)
  if (key.asyncExchange !== true) {
    throw asyncExchangeNotEnabled(clientId);
  }

  // 4. Verify client assertion signature
  const { errors: clientAssertionSignatureErrors } =
    await verifyClientAssertionSignature(
      clientAssertionJWS,
      key,
      clientAssertionJWT.header.alg
    );

  if (clientAssertionSignatureErrors) {
    throw clientAssertionSignatureValidationFailed(
      clientId,
      clientAssertionSignatureErrors.map((error) => error.detail).join(", ")
    );
  }

  // 5. Validate platform state
  const { errors: platformStateErrors } = validatePlatformState(key);
  if (platformStateErrors) {
    throw platformStateValidationFailed(
      platformStateErrors.map((error) => error.detail).join(", ")
    );
  }

  // 6. Rate limiting (before catalog fetch to short-circuit early)
  const { limitReached, ...rateLimiterStatus } =
    await redisRateLimiter.rateLimitByOrganization(key.consumerId, logger);
  if (limitReached) {
    return {
      limitReached: true as const,
      rateLimitedTenantId: key.consumerId,
      rateLimiterStatus,
    };
  }

  // 7. Retrieve catalog entry from platform-states for async exchange properties
  const { eserviceId, descriptorId } = deconstructGSIPK_eserviceId_descriptorId(
    key.GSIPK_eserviceId_descriptorId
  );

  const catalogEntry = await retrieveCatalogEntry(
    dynamoDBClient,
    eserviceId,
    descriptorId,
    platformStatesTable
  );

  const { asyncExchangeProperties } = catalogEntry;
  if (!asyncExchangeProperties) {
    throw genericInternalError(
      `Catalog entry for eService ${eserviceId} descriptor ${descriptorId} has asyncExchange enabled but no asyncExchangeProperties`
    );
  }

  // 8. Generate token first, then persist interaction to avoid orphaned rows
  const interactionId = generateId<InteractionId>();

  const ttlSeconds =
    asyncExchangeProperties.responseTime +
    asyncExchangeProperties.resourceAvailableTime +
    interactionTtlEpsilonSeconds;

  const token = await tokenGenerator.generateInteropAsyncConsumerToken({
    sub: clientId,
    audience: key.descriptorAudience,
    purposeId,
    tokenDurationInSeconds: key.descriptorVoucherLifespan,
    digest: clientAssertionJWT.payload.digest || undefined,
    producerId: key.producerId,
    consumerId: key.consumerId,
    eserviceId,
    descriptorId,
    interactionId,
    urlCallback,
    scope: interactionState.startInteraction,
    dpopJWK: dpopProofJWT?.header.jwk,
  });

  // Use the token's iat so interaction and token share the same timestamp
  const issuedAt = new Date(token.payload.iat * 1000).toISOString();

  // 9. Persist interaction only after successful token generation
  await createInteraction({
    dynamoDBClient,
    interactionsTable,
    interactionId,
    purposeId,
    consumerId: key.consumerId,
    eServiceId: eserviceId,
    descriptorId,
    issuedAt,
    ttlSeconds,
  });

  // 10. Publish audit
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

  // 11. Log and return
  logTokenGenerationInfo({
    validatedJwt: clientAssertionJWT,
    clientKind: key.clientKind,
    tokenJti: token.payload.jti,
    message: "Async token generated (start_interaction)",
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
