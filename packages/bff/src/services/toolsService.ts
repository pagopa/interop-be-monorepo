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
  EServiceId,
  genericInternalError,
  ItemState,
  PurposeId,
  TenantId,
  unsafeBrandId,
} from "pagopa-interop-models";
import { getAllFromPaginated, WithLogger } from "pagopa-interop-commons";
import {
  agreementApi,
  authorizationApi,
  bffApi,
  catalogApi,
  purposeApi,
} from "pagopa-interop-api-clients";
import {
  AgreementProcessClient,
  CatalogProcessClient,
  PagoPAInteropBeClients,
} from "../providers/clientProvider.js";
import { BffAppContext } from "../utilities/context.js";
import {
  eserviceDescriptorNotFound,
  missingActivePurposeVersion,
} from "../model/domain/errors.js";

export function toolsServiceBuilder(clients: PagoPAInteropBeClients) {
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
        client_assertion_type:
          "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
        grant_type: "client_credentials",
        client_id: clientId,
      });

      const { data: jwt } = verifyClientAssertion(clientAssertion, clientId);
      if (!jwt) {
        throw genericInternalError("Invalid client assertion");
      }

      const key = await retrieveKey(clients, jwt, ctx);

      verifyClientAssertionSignature(clientAssertion, key);
      validateClientKindAndPlatformState(key, jwt);

      return {};
    },
  };
}

export type ToolsService = ReturnType<typeof toolsServiceBuilder>;

async function retrieveKey(
  {
    authorizationClient,
    purposeProcessClient,
    agreementProcessClient,
    catalogProcessClient,
  }: PagoPAInteropBeClients,
  jwt: ClientAssertion,
  ctx: WithLogger<BffAppContext>
): Promise<ApiKey | ConsumerKey> {
  const client = await authorizationClient.token.getKeyWithClientByKeyId({
    params: {
      clientId: jwt.payload.sub,
      keyId: jwt.header.kid,
    },
    headers: ctx.headers,
  });

  const { encodedPem } = await authorizationClient.client.getClientKeyById({
    headers: ctx.headers,
    params: {
      clientId: client.client.id,
      keyId: jwt.header.kid,
    },
  });

  const purposeId = unsafeBrandId<PurposeId>(jwt.payload.purposeId ?? ""); // TODO check if not exists

  if (client.client.kind === authorizationApi.ClientKind.enum.API) {
    return {
      clientKind: authorizationApi.ClientKind.enum.API,
      kid: jwt.header.kid,
      algorithm: "RS256",
      publicKey: encodedPem,
      clientId: unsafeBrandId<ClientId>(jwt.payload.iss),
      consumerId: unsafeBrandId<TenantId>(client.client.consumerId),
      purposeId,
    };
  }

  const purpose = await purposeProcessClient.getPurpose({
    params: { id: purposeId },
    headers: ctx.headers,
  });

  const agreement = await retrieveAgreement(
    agreementProcessClient,
    purpose.consumerId,
    purpose.eserviceId,
    ctx
  );

  const descriptor = await retrieveDescriptor(
    catalogProcessClient,
    agreement.eserviceId,
    agreement.descriptorId,
    ctx
  );

  return {
    clientKind: authorizationApi.ClientKind.enum.CONSUMER,
    clientId: unsafeBrandId<ClientId>(jwt.payload.iss),
    kid: jwt.header.kid,
    algorithm: "RS256",
    publicKey: encodedPem,
    purposeId,
    consumerId: unsafeBrandId<TenantId>(client.client.consumerId),
    agreementId: unsafeBrandId<AgreementId>(agreement.id),
    eServiceId: unsafeBrandId<EServiceId>(agreement.eserviceId),
    agreementState: agreementStateToItemState(agreement.state),
    purposeState: retrievePurposeItemState(purpose),
    descriptorState: descriptorStateToItemState(descriptor.state),
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

async function retrieveDescriptor(
  catalogClient: CatalogProcessClient,
  eserviceId: string,
  descriptorId: string,
  ctx: WithLogger<BffAppContext>
): Promise<catalogApi.EServiceDescriptor> {
  const eservice = await catalogClient.getEServiceById({
    params: { eServiceId: eserviceId },
    headers: ctx.headers,
  });

  const descriptor = eservice.descriptors.find((d) => d.id === descriptorId);
  if (!descriptor) {
    throw eserviceDescriptorNotFound(eservice.id, descriptorId);
  }

  return descriptor;
}

function retrievePurposeItemState(purpose: purposeApi.Purpose): ItemState {
  const activePurposeVersion = [...purpose.versions]
    .sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    )
    .find(
      (v) =>
        v.state === purposeApi.PurposeVersionState.Enum.ACTIVE ||
        v.state === purposeApi.PurposeVersionState.Enum.SUSPENDED
    );

  if (!activePurposeVersion) {
    throw missingActivePurposeVersion(purpose.id);
  }

  return purposeVersionStateToItemState(activePurposeVersion.state);
}

const agreementStateToItemState = (
  state: agreementApi.AgreementState
): ItemState =>
  state === agreementApi.AgreementState.Values.ACTIVE
    ? ItemState.Enum.ACTIVE
    : ItemState.Enum.INACTIVE;

const descriptorStateToItemState = (
  state: catalogApi.EServiceDescriptorState
): ItemState =>
  state === catalogApi.EServiceDescriptorState.Enum.PUBLISHED ||
  state === catalogApi.EServiceDescriptorState.Enum.DEPRECATED
    ? ItemState.Enum.ACTIVE
    : ItemState.Enum.INACTIVE;

const purposeVersionStateToItemState = (
  state: purposeApi.PurposeVersionState
): ItemState =>
  state === purposeApi.PurposeVersionState.Enum.ACTIVE
    ? ItemState.Enum.ACTIVE
    : ItemState.Enum.INACTIVE;
