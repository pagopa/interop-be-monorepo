import {
  clientKindTokenGenStates,
  interactionState,
  itemState,
  makeProducerKeychainPlatformStatesPK,
  unsafeBrandId,
  ProducerKeychainId,
  TenantId,
} from "pagopa-interop-models";
import { verifyClientAssertionSignature } from "pagopa-interop-client-assertion-validation";
import {
  clientAssertionSignatureValidationFailed,
  entityNumberNotProvided,
  interactionIdNotProvided,
  interactionNotFound,
  interactionStateNotAllowed,
  invalidEntityNumber,
  platformStateValidationFailed,
  asyncExchangeResponseTimeExceeded,
  entityNumberExceedsMaxResultSet,
} from "../../model/domain/errors.js";
import {
  logTokenGenerationInfo,
  publishProducerAudit,
  retrieveCatalogEntry,
  retrieveProducerKey,
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
    producerKeychainPlatformStatesTable,
  } = ctx;

  const clientId = clientAssertionJWT.payload.sub;

  // 1. Validate callback_invocation-specific claims
  const interactionId = clientAssertionJWT.payload.interactionId;
  if (!interactionId) {
    throw interactionIdNotProvided(clientId);
  }

  const entityNumber = clientAssertionJWT.payload.entityNumber;
  if (entityNumber === undefined || entityNumber === null) {
    throw entityNumberNotProvided(clientId);
  }
  if (entityNumber <= 0) {
    throw invalidEntityNumber(clientId, entityNumber);
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

  // 5–7. Retrieve producer key and catalog entry in parallel (both depend on interaction data)
  const kid = clientAssertionJWT.header.kid;
  const producerKeychainId = unsafeBrandId<ProducerKeychainId>(clientId);
  const producerKeyPK = makeProducerKeychainPlatformStatesPK({
    producerKeychainId,
    kid,
    eServiceId,
  });
  const [producerKey, catalogEntry] = await Promise.all([
    retrieveProducerKey(
      dynamoDBClient,
      producerKeychainPlatformStatesTable,
      producerKeyPK
    ),
    retrieveCatalogEntry(
      dynamoDBClient,
      eServiceId,
      descriptorId,
      platformStatesTable
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

  // 7. Validate catalog entry state
  if (catalogEntry.state !== itemState.active) {
    throw platformStateValidationFailed(
      `E-Service descriptor state is: ${catalogEntry.state}`
    );
  }

  // 8. Validate asyncExchangeResponseTime (responseTime is in seconds)
  const { asyncExchangeProperties } = catalogEntry;
  if (asyncExchangeProperties && interaction.startInteractionTokenIssuedAt) {
    const elapsedMs =
      Date.now() - Date.parse(interaction.startInteractionTokenIssuedAt);
    const responseTimeLimitMs = asyncExchangeProperties.responseTime * 1000;
    if (elapsedMs >= responseTimeLimitMs) {
      throw asyncExchangeResponseTimeExceeded(
        interactionId,
        elapsedMs,
        responseTimeLimitMs
      );
    }
  }

  // 9. Validate entityNumber <= maxResultSet
  if (asyncExchangeProperties) {
    if (entityNumber > asyncExchangeProperties.maxResultSet) {
      throw entityNumberExceedsMaxResultSet(
        clientId,
        entityNumber,
        asyncExchangeProperties.maxResultSet
      );
    }
  }

  // 10. Rate limiting
  // Using producerKeychainId as the rate limiter key since we don't have the producer's TenantId
  const rateLimiterTenantId = unsafeBrandId<TenantId>(clientId);
  setCtxOrganizationId(rateLimiterTenantId);
  setCtxClientKind(clientKindTokenGenStates.consumer);
  const { limitReached, ...rateLimiterStatus } =
    await redisRateLimiter.rateLimitByOrganization(rateLimiterTenantId, logger);
  if (limitReached) {
    return {
      limitReached: true as const,
      rateLimitedTenantId: rateLimiterTenantId,
      rateLimiterStatus,
    };
  }

  // 11. Generate token first, then update interaction state.
  //     These must be sequential: if token generation fails we must not
  //     persist a state transition for a token that was never delivered.
  const issuedAt = new Date().toISOString();

  const token = await tokenGenerator.generateInteropAsyncConsumerToken({
    sub: clientId,
    audience: catalogEntry.descriptorAudience,
    purposeId: interaction.purposeId,
    tokenDurationInSeconds: catalogEntry.descriptorVoucherLifespan,
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

  // 12. Publish audit
  await publishProducerAudit({
    producer,
    generatedToken: token,
    organizationId: producerKey.producerId,
    eserviceId: eServiceId,
    descriptorId,
    purposeId: interaction.purposeId,
    clientAssertion: clientAssertionJWT,
    dpop: dpopProofJWT,
    correlationId,
    fileManager,
    logger,
  });

  // 13. Log and return
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
