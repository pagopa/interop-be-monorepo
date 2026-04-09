import {
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
  asyncExchangeNotEnabled,
  clientAssertionSignatureValidationFailed,
  platformStateValidationFailed,
  purposeIdNotProvided,
  urlCallbackNotProvided,
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
  ctx: ScopeHandlerContext,
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

  const urlCallback = clientAssertionJWT.payload.urlCallback;
  if (!urlCallback) {
    throw urlCallbackNotProvided(clientAssertionJWT.payload.sub);
  }

  const clientId = clientAssertionJWT.payload.sub;
  const purposeId = clientAssertionJWT.payload.purposeId;
  if (!purposeId) {
    throw purposeIdNotProvided(clientId);
  }

  const kid = clientAssertionJWT.header.kid;
  const pk = makeTokenGenerationStatesClientKidPurposePK({
    clientId,
    kid,
    purposeId,
  });
  const key = await retrieveKey(dynamoDBClient, pk);

  if (key.clientKind !== clientKindTokenGenStates.consumer) {
    throw genericInternalError(
      `Expected consumer client kind for start_interaction, got ${key.clientKind}`,
    );
  }

  setCtxOrganizationId(key.consumerId);
  setCtxClientKind(key.clientKind);

  // Cheap check before crypto
  if (key.asyncExchange !== true) {
    throw asyncExchangeNotEnabled(clientId);
  }

  const { errors: clientAssertionSignatureErrors } =
    await verifyClientAssertionSignature(
      clientAssertionJWS,
      key,
      clientAssertionJWT.header.alg,
    );

  if (clientAssertionSignatureErrors) {
    throw clientAssertionSignatureValidationFailed(
      clientId,
      clientAssertionSignatureErrors.map((error) => error.detail).join(", "),
    );
  }

  const { errors: platformStateErrors } = validatePlatformState(key);
  if (platformStateErrors) {
    throw platformStateValidationFailed(
      platformStateErrors.map((error) => error.detail).join(", "),
    );
  }

  const { limitReached, ...rateLimiterStatus } =
    await redisRateLimiter.rateLimitByOrganization(key.consumerId, logger);
  if (limitReached) {
    return {
      limitReached: true as const,
      rateLimitedTenantId: key.consumerId,
      rateLimiterStatus,
    };
  }

  const { eserviceId, descriptorId } = deconstructGSIPK_eserviceId_descriptorId(
    key.GSIPK_eserviceId_descriptorId,
  );

  const catalogEntry = await retrieveCatalogEntry(
    dynamoDBClient,
    eserviceId,
    descriptorId,
    platformStatesTable,
  );

  const { asyncExchangeProperties } = catalogEntry;
  if (!asyncExchangeProperties) {
    throw genericInternalError(
      `Catalog entry for eService ${eserviceId} descriptor ${descriptorId} has asyncExchange enabled but no asyncExchangeProperties`,
    );
  }

  // Generate token first, then persist interaction to avoid orphaned rows
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
