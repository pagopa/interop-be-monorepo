import { IncomingHttpHeaders } from "http";
import {
  validateRequestParameters,
  verifyClientAssertion,
  verifyClientAssertionSignature,
} from "pagopa-interop-client-assertion-validation";
import { authorizationServerApi } from "pagopa-interop-api-clients";
import {
  ClientId,
  ClientKindTokenGenStates,
  InteractionState,
  interactionState,
  makeTokenGenerationStatesClientKidPK,
  makeTokenGenerationStatesClientKidPurposePK,
  TenantId,
  unsafeBrandId,
} from "pagopa-interop-models";
import {
  AuthServerAppContext,
  isFeatureFlagEnabled,
  Logger,
  WithLogger,
} from "pagopa-interop-commons";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { match } from "ts-pattern";
import { config } from "../config/config.js";
import {
  asyncRequestValidationFailed,
  asyncScopeNotYetImplemented,
  clientAssertionSignatureValidationFailed,
  clientAssertionValidationFailed,
  invalidAsyncScope,
} from "../model/domain/errors.js";
import { HttpDPoPHeader } from "../model/domain/models.js";
import { retrieveKey } from "./tokenService.js";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function asyncTokenServiceBuilder({
  dynamoDBClient,
}: {
  dynamoDBClient: DynamoDBClient;
}) {
  return {
    // eslint-disable-next-line max-params
    async generateAsyncToken(
      _headers: IncomingHttpHeaders & HttpDPoPHeader,
      body: authorizationServerApi.AsyncAccessTokenRequest,
      getCtx: () => WithLogger<AuthServerAppContext>,
      setCtxClientId: (clientId: ClientId) => void,
      setCtxClientKind: (tokenGenClientKind: ClientKindTokenGenStates) => void,
      setCtxOrganizationId: (organizationId: TenantId) => void
    ): Promise<void> {
      if (body.client_id) {
        setCtxClientId(unsafeBrandId(body.client_id));
      }

      getCtx().logger.info(
        `[CLIENTID=${body.client_id}] Async token requested`
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

      // Parse async scope from client assertion
      const scope = parseAsyncScope(
        clientAssertionJWT.payload,
        getCtx().logger
      );

      getCtx().logger.info(
        `[CLIENTID=${clientId}][SCOPE=${scope}] Async scope parsed`
      );

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

      // Dispatch by async scope
      await dispatchByScope(scope);
    },
  };
}

export type AsyncTokenService = ReturnType<typeof asyncTokenServiceBuilder>;

const parseAsyncScope = (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: Record<string, any>,
  logger: Logger
): InteractionState => {
  const rawScope = payload.scope;

  const parsed = InteractionState.safeParse(rawScope);
  if (!parsed.success) {
    logger.warn(`Invalid async scope received: ${rawScope}`);
    throw invalidAsyncScope(String(rawScope ?? "undefined"));
  }

  return parsed.data;
};

const dispatchByScope = async (scope: InteractionState): Promise<void> =>
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
