/* eslint-disable @typescript-eslint/explicit-function-return-type */

import {
  ApiKey,
  ClientAssertion,
  ConsumerKey,
  validateClientKindAndPlatformState,
  validateRequestParameters,
  verifyClientAssertion,
  verifyClientAssertionSignature,
} from "pagopa-interop-client-assertion-validation";
import {
  AgreementId,
  ClientId,
  genericInternalError,
  PurposeId,
  TenantId,
  unsafeBrandId,
} from "pagopa-interop-models";
import { getAllFromPaginated, WithLogger } from "pagopa-interop-commons";
import {
  agreementApi,
  authorizationApi,
  bffApi,
  purposeApi,
} from "pagopa-interop-api-clients";
import {
  AgreementProcessClient,
  PagoPAInteropBeClients,
} from "../providers/clientProvider.js";
import { BffAppContext } from "../utilities/context.js";

export function toolsServiceBuilder(clients: PagoPAInteropBeClients) {
  const { purposeProcessClient, authorizationClient, agreementProcessClient } =
    clients;
  return {
    async validateTokenGeneration(
      clientId: string | undefined,
      clientAssertion: string,
      _clientAssertionType: string,
      _grantType: string,
      ctx: WithLogger<BffAppContext>
    ): Promise<bffApi.TokenGenerationValidationResult> {
      // TODO HANDLE ERRORS!
      validateRequestParameters({
        client_assertion: clientAssertion,
        client_assertion_type: "urn:ietf:params:oauth:client-assert",
        grant_type: "client_credentials",
        client_id: clientId,
      });

      const { data: jwt } = verifyClientAssertion(clientAssertion, clientId);
      if (!jwt) {
        throw genericInternalError("Invalid client assertion");
      }

      const clientWithKeys =
        await authorizationClient.token.getKeyWithClientByKeyId({
          params: {
            clientId: jwt.payload.sub,
            keyId: jwt.header.kid,
          },
          headers: ctx.headers,
        });

      const purpose = await purposeProcessClient.getPurpose({
        params: { id: jwt.payload.purposeId ?? "" }, // TODO check if not exists
        headers: ctx.headers,
      });

      const agreement = await retrieveAgreement(
        agreementProcessClient,
        purpose.consumerId,
        purpose.eserviceId,
        ctx
      );

      const key = getKey(jwt, clientWithKeys, agreement, purpose);

      verifyClientAssertionSignature(clientAssertion, key);
      validateClientKindAndPlatformState(key, jwt);

      return {};
    },
  };
}

export type ToolsService = ReturnType<typeof toolsServiceBuilder>;

function getKey(
  jwt: ClientAssertion,
  client: authorizationApi.KeyWithClient,
  agreement: agreementApi.Agreement,
  purpose: purposeApi.Purpose
): ApiKey | ConsumerKey {
  return {
    clientId: unsafeBrandId<ClientId>(jwt.payload.iss),
    kid: jwt.header.kid,
    consumerId: unsafeBrandId<TenantId>(client.client.consumerId),
    algorithm: "RS256",
    agreementId: unsafeBrandId<AgreementId>(agreement.id),
    purposeId: unsafeBrandId<PurposeId>(purpose.id),
  };
}

async function retrieveAgreement(
  agreementClient: AgreementProcessClient,
  consumerId: string,
  eserviceId: string,
  ctx: WithLogger<BffAppContext>
): Promise<agreementApi.Agreement> {
  const agreements = await getAllFromPaginated<agreementApi.Agreement>(
    async (offset, limit) =>
      await agreementClient.getAgreements({
        headers: ctx.headers,
        queries: {
          offset,
          limit,
          consumersIds: [consumerId],
          eservicesIds: [eserviceId],
          states: [
            agreementApi.AgreementState.Values.ACTIVE,
            agreementApi.AgreementState.Values.SUSPENDED,
          ],
        },
      })
  );

  // TODO assert only one exists

  return agreements[0];
}
