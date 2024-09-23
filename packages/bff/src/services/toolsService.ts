/* eslint-disable @typescript-eslint/explicit-function-return-type */

import {
  ApiKey,
  ClientAssertion,
  ConsumerKey,
  FailedValidation,
  SuccessfulValidation,
  validateClientKindAndPlatformState,
  validateRequestParameters,
  verifyClientAssertion,
  verifyClientAssertionSignature,
} from "pagopa-interop-client-assertion-validation";
import {
  AgreementId,
  ApiError,
  ClientId,
  EServiceId,
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
  activeAgreementByEserviceAndConsumerNotFound,
  clientAssertionPublicKeyNotFound,
  ErrorCodes,
  eserviceDescriptorNotFound,
  missingActivePurposeVersion,
  multipleAgreementForEserviceAndConsumer,
  purposeIdNotFoundInClientAssertion,
} from "../model/domain/errors.js";
import { TokenGenerationValidationStepFailure } from "../../../api-clients/dist/bffApi.js";

export function toolsServiceBuilder(clients: PagoPAInteropBeClients) {
  return {
    async validateTokenGeneration(
      clientId: string | undefined,
      clientAssertion: string,
      _clientAssertionType: string,
      _grantType: string,
      ctx: WithLogger<BffAppContext>
    ): Promise<bffApi.TokenGenerationValidationResult> {
      const { errors: parametersErrors } = validateRequestParameters({
        client_assertion: clientAssertion,
        client_assertion_type:
          "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
        grant_type: "client_credentials",
        client_id: clientId,
      });

      const { data: jwt, errors: clientAssertionErrors } =
        verifyClientAssertion(clientAssertion, clientId);

      if (parametersErrors || clientAssertionErrors) {
        return handleValidationResults({
          clientAssertionErrors: [
            ...(parametersErrors ?? []),
            ...(clientAssertionErrors ?? []),
          ],
        });
      }

      const { data: key, errors: keyRetrieveErrors } = await retrieveKey(
        clients,
        jwt,
        ctx
      );

      if (keyRetrieveErrors) {
        return handleValidationResults({
          keyRetrieveErrors,
        });
      }

      const { errors: clientSignatureErrors } = verifyClientAssertionSignature(
        clientAssertion,
        key
      );

      if (clientSignatureErrors) {
        return handleValidationResults({
          clientSignatureErrors,
        });
      }

      const { errors: platformStateErrors } =
        validateClientKindAndPlatformState(key, jwt);

      if (platformStateErrors) {
        return handleValidationResults({
          platformStateErrors,
        });
      }

      return handleValidationResults({});
    },
  };
}

export type ToolsService = ReturnType<typeof toolsServiceBuilder>;

// TODO add client kind and eservice
function handleValidationResults(errs: {
  clientAssertionErrors?: Array<ApiError<string>>;
  keyRetrieveErrors?: Array<ApiError<string>>;
  clientSignatureErrors?: Array<ApiError<string>>;
  platformStateErrors?: Array<ApiError<string>>;
}): bffApi.TokenGenerationValidationResult {
  const clientAssertionErrors = errs.clientAssertionErrors ?? [];
  const keyRetrieveErrors = errs.keyRetrieveErrors ?? [];
  const clientSignatureErrors = errs.clientSignatureErrors ?? [];
  const platformStateErrors = errs.platformStateErrors ?? [];

  return {
    clientKind: undefined,
    eserviceId: undefined,
    steps: {
      clientAssertionValidation: {
        result: getStepResult([], clientAssertionErrors),
        failures: apiErrorsToValidationFailures(clientAssertionErrors),
      },
      publicKeyRetrieve: {
        result: getStepResult(clientAssertionErrors, keyRetrieveErrors),
        failures: apiErrorsToValidationFailures(keyRetrieveErrors),
      },
      clientAssertionSignatureVerification: {
        result: getStepResult(
          [...clientAssertionErrors, ...keyRetrieveErrors],
          clientSignatureErrors
        ),
        failures: apiErrorsToValidationFailures(clientSignatureErrors),
      },
      platformStatesVerification: {
        result: getStepResult(
          [
            ...clientAssertionErrors,
            ...keyRetrieveErrors,
            ...clientSignatureErrors,
          ],
          platformStateErrors
        ),
        failures: apiErrorsToValidationFailures(platformStateErrors),
      },
    },
  };
}

function getStepResult(
  prevStepErrors: Array<ApiError<string>>,
  currentStepErrors: Array<ApiError<string>>
): bffApi.TokenGenerationValidationStepResult {
  if (currentStepErrors.length > 0) {
    return bffApi.TokenGenerationValidationStepResult.Enum.FAILED;
  } else if (prevStepErrors.length > 0) {
    return bffApi.TokenGenerationValidationStepResult.Enum.SKIPPED;
  } else {
    return bffApi.TokenGenerationValidationStepResult.Enum.PASSED;
  }
}

async function retrieveKey(
  {
    authorizationClient,
    purposeProcessClient,
    agreementProcessClient,
    catalogProcessClient,
  }: PagoPAInteropBeClients,
  jwt: ClientAssertion,
  ctx: WithLogger<BffAppContext>
): Promise<
  SuccessfulValidation<ApiKey | ConsumerKey> | FailedValidation<ErrorCodes>
> {
  const client = await authorizationClient.token
    .getKeyWithClientByKeyId({
      params: {
        clientId: jwt.payload.sub,
        keyId: jwt.header.kid,
      },
      headers: ctx.headers,
    })
    .catch(() => undefined);

  if (!client) {
    return {
      data: undefined,
      errors: [
        clientAssertionPublicKeyNotFound(jwt.header.kid, jwt.payload.sub),
      ],
    };
  }

  const { encodedPem } = await authorizationClient.client.getClientKeyById({
    headers: ctx.headers,
    params: {
      clientId: client.client.id,
      keyId: jwt.header.kid,
    },
  });

  if (!jwt.payload.purposeId) {
    return {
      data: undefined,
      errors: [purposeIdNotFoundInClientAssertion()],
    };
  }
  const purposeId = unsafeBrandId<PurposeId>(jwt.payload.purposeId);

  if (client.client.kind === authorizationApi.ClientKind.enum.API) {
    return {
      errors: undefined,
      data: {
        clientKind: authorizationApi.ClientKind.enum.API,
        kid: jwt.header.kid,
        algorithm: "RS256",
        publicKey: encodedPem,
        clientId: unsafeBrandId<ClientId>(jwt.payload.iss),
        consumerId: unsafeBrandId<TenantId>(client.client.consumerId),
        purposeId,
      },
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
    errors: undefined,
    data: {
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
    },
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

  assertOnlyOneAgreementForEserviceAndConsumerExists(
    agreements,
    eserviceId,
    consumerId
  );
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

export function assertOnlyOneAgreementForEserviceAndConsumerExists(
  agreements: agreementApi.Agreement[],
  eserviceId: string,
  consumerId: string
): asserts agreements is [agreementApi.Agreement] {
  if (agreements.length === 0) {
    throw activeAgreementByEserviceAndConsumerNotFound(eserviceId, consumerId);
  } else if (agreements.length > 1) {
    throw multipleAgreementForEserviceAndConsumer(eserviceId, consumerId);
  }
}

function apiErrorsToValidationFailures<T extends string>(
  errors: Array<ApiError<T>> | undefined
): TokenGenerationValidationStepFailure[] {
  if (!errors) {
    return [];
  }

  return errors.map((err) => ({
    code: err.code,
    reason: err.message,
  }));
}