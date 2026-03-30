/* eslint-disable @typescript-eslint/explicit-function-return-type */

import { isAxiosError } from "axios";
import {
  FailedValidation,
  SuccessfulValidation,
  validateClientKindAndPlatformState,
  validateRequestParameters,
  verifyAsyncClientAssertion,
  verifyClientAssertion,
  verifyClientAssertionSignature,
} from "pagopa-interop-client-assertion-validation";
import {
  AgreementId,
  ApiError,
  AsyncClientAssertion,
  ClientAssertion,
  ClientId,
  DescriptorId,
  EServiceId,
  GSIPKClientIdKid,
  interactionState,
  InteractionState,
  ItemState,
  makeGSIPKClientIdPurposeId,
  makeGSIPKConsumerIdEServiceId,
  makeGSIPKEServiceIdDescriptorId,
  makeTokenGenerationStatesClientKidPK,
  makeTokenGenerationStatesClientKidPurposePK,
  ProducerKeychainId,
  PurposeId,
  TenantId,
  TokenGenerationStatesGenericClient,
  unsafeBrandId,
} from "pagopa-interop-models";
import { isFeatureFlagEnabled, WithLogger } from "pagopa-interop-commons";
import {
  agreementApi,
  authorizationApi,
  bffApi,
  catalogApi,
  purposeApi,
} from "pagopa-interop-api-clients";
import { match } from "ts-pattern";
import { BffAppContext } from "../utilities/context.js";
import {
  activeAgreementByEserviceAndConsumerNotFound,
  cannotGetKeyWithClient,
  clientAssertionPublicKeyNotFound,
  ErrorCodes,
  eserviceDescriptorNotFound,
  missingActivePurposeVersion,
  purposeIdNotFoundInClientAssertion,
  purposeNotFound,
  tenantNotAllowed,
} from "../model/errors.js";
import { PagoPAInteropBeClients } from "../clients/clientsProvider.js";
import { config } from "../config/config.js";
import { getAllAgreements } from "./agreementService.js";
import {
  AsyncValidationContext,
  ToolServiceStorage,
} from "./toolService.types.js";
import {
  buildConsumerAsyncPlatformErrors,
  buildProducerAsyncPlatformErrors,
  buildStartInteractionPlatformErrors,
  isInteractionStateAllowedForScope,
  makeDiagnosticError,
  readInteractionById,
  toAsyncCatalogValidationContext,
  validateAsyncScopeClaims,
} from "./toolServiceUtils.js";
import { assertProducerKeychainVisibilityIsFull } from "./validators.js";

export function toolsServiceBuilder(
  clients: PagoPAInteropBeClients,
  storage?: ToolServiceStorage
) {
  return {
    async validateTokenGeneration(
      clientId: string | undefined,
      clientAssertion: string,
      clientAssertionType: string,
      grantType: string,
      ctx: WithLogger<BffAppContext>
    ): Promise<bffApi.TokenGenerationValidationResult> {
      ctx.logger.info(`Validating token generation for client ${clientId}`);

      const { errors: parametersErrors } = validateRequestParameters({
        client_assertion: clientAssertion,
        client_assertion_type: clientAssertionType,
        grant_type: grantType,
        client_id: clientId,
      });

      const { data: jwt, errors: clientAssertionErrors } =
        verifyClientAssertion(
          clientAssertion,
          clientId,
          config.clientAssertionAudience,
          ctx.logger,
          isFeatureFlagEnabled(
            config,
            "featureFlagClientAssertionStrictClaimsValidation"
          )
        );

      if (parametersErrors || clientAssertionErrors) {
        return handleValidationResults({
          clientAssertionErrors: [
            ...(parametersErrors ?? []),
            ...(clientAssertionErrors ?? []),
          ],
        });
      }

      const { data, errors: keyRetrieveErrors } = await retrieveKeyAndEservice(
        clients,
        jwt,
        ctx
      );
      if (keyRetrieveErrors) {
        return handleValidationResults({ keyRetrieveErrors });
      }

      const { key, eservice: keyEservice, descriptor: keyDescriptor } = data;
      const eservice =
        keyEservice && keyDescriptor
          ? toTokenValidationEService(keyEservice, keyDescriptor)
          : undefined;

      const { errors: clientAssertionSignatureErrors } =
        await verifyClientAssertionSignature(
          clientAssertion,
          key,
          jwt.header.alg
        );
      if (clientAssertionSignatureErrors) {
        return handleValidationResults(
          { clientAssertionSignatureErrors },
          key.clientKind,
          eservice
        );
      }

      const { errors: platformStateErrors } =
        validateClientKindAndPlatformState(key, jwt);
      if (platformStateErrors) {
        return handleValidationResults(
          { platformStateErrors },
          key.clientKind,
          eservice
        );
      }

      return handleValidationResults({}, key.clientKind, eservice);
    },

    async validateAsyncTokenGeneration(
      clientId: string | undefined,
      clientAssertion: string,
      clientAssertionType: string,
      grantType: string,
      ctx: WithLogger<BffAppContext>
    ): Promise<bffApi.TokenGenerationValidationResult> {
      if (!storage) {
        throw new Error("Async token validation storage is not configured");
      }

      ctx.logger.info(
        `Validating async token generation for client ${clientId}`
      );

      const { errors: parametersErrors } = validateRequestParameters({
        client_assertion: clientAssertion,
        client_assertion_type: clientAssertionType,
        grant_type: grantType,
        client_id: clientId,
      });

      const { data: jwt, errors: clientAssertionErrors } =
        verifyAsyncClientAssertion(
          clientAssertion,
          clientId,
          config.clientAssertionAudience,
          ctx.logger,
          isFeatureFlagEnabled(
            config,
            "featureFlagClientAssertionStrictClaimsValidation"
          )
        );

      const asyncClaimErrors = jwt ? validateAsyncScopeClaims(jwt) : undefined;

      if (parametersErrors || clientAssertionErrors || asyncClaimErrors) {
        return handleValidationResults({
          clientAssertionErrors: [
            ...(parametersErrors ?? []),
            ...(clientAssertionErrors ?? []),
            ...(asyncClaimErrors ?? []),
          ],
        });
      }

      const { data, errors: keyRetrieveErrors } =
        await retrieveAsyncValidationContext(clients, storage, jwt, ctx);
      if (keyRetrieveErrors) {
        return handleValidationResults({ keyRetrieveErrors });
      }

      const { errors: clientAssertionSignatureErrors } =
        await verifyClientAssertionSignature(
          clientAssertion,
          data.verificationKey,
          jwt.header.alg
        );
      if (clientAssertionSignatureErrors) {
        return handleValidationResults(
          { clientAssertionSignatureErrors },
          data.clientKind,
          data.eservice
        );
      }

      const platformStateErrors = [
        ...(data.platformStateErrors ?? []),
        ...((data.platformValidationKey && data.platformValidationJwt
          ? validateClientKindAndPlatformState(
              data.platformValidationKey,
              data.platformValidationJwt
            ).errors
          : undefined) ?? []),
      ];

      if (platformStateErrors.length > 0) {
        return handleValidationResults(
          { platformStateErrors },
          data.clientKind,
          data.eservice
        );
      }

      return handleValidationResults({}, data.clientKind, data.eservice);
    },
  };
}

export type ToolsService = ReturnType<typeof toolsServiceBuilder>;

function handleValidationResults(
  errs: {
    clientAssertionErrors?: Array<ApiError<string>>;
    keyRetrieveErrors?: Array<ApiError<string>>;
    clientAssertionSignatureErrors?: Array<ApiError<string>>;
    platformStateErrors?: Array<ApiError<string>>;
  },
  clientKind?: authorizationApi.ClientKind,
  eservice?: bffApi.TokenGenerationValidationEService
): bffApi.TokenGenerationValidationResult {
  const clientAssertionErrors = errs.clientAssertionErrors ?? [];
  const keyRetrieveErrors = errs.keyRetrieveErrors ?? [];
  const clientAssertionSignatureErrors =
    errs.clientAssertionSignatureErrors ?? [];
  const platformStateErrors = errs.platformStateErrors ?? [];

  return {
    clientKind,
    eservice,
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
          clientAssertionSignatureErrors
        ),
        failures: apiErrorsToValidationFailures(clientAssertionSignatureErrors),
      },
      platformStatesVerification: {
        result: getStepResult(
          [
            ...clientAssertionErrors,
            ...keyRetrieveErrors,
            ...clientAssertionSignatureErrors,
          ],
          platformStateErrors
        ),
        failures: apiErrorsToValidationFailures(platformStateErrors),
      },
    },
  };
}

async function retrieveAsyncValidationContext(
  clients: PagoPAInteropBeClients,
  storage: ToolServiceStorage,
  jwt: AsyncClientAssertion,
  ctx: WithLogger<BffAppContext>
): Promise<
  SuccessfulValidation<AsyncValidationContext> | FailedValidation<string>
> {
  return match(jwt.payload.scope)
    .with(interactionState.startInteraction, () =>
      retrieveStartInteractionValidationContext(clients, jwt, ctx)
    )
    .with(interactionState.getResource, interactionState.confirmation, () =>
      retrieveConsumerAsyncValidationContext(clients, storage, jwt, ctx)
    )
    .with(interactionState.callbackInvocation, () =>
      retrieveProducerAsyncValidationContext(clients, storage, jwt, ctx)
    )
    .exhaustive();
}

async function retrieveStartInteractionValidationContext(
  clients: PagoPAInteropBeClients,
  jwt: AsyncClientAssertion,
  ctx: WithLogger<BffAppContext>
): Promise<
  SuccessfulValidation<AsyncValidationContext> | FailedValidation<string>
> {
  const { data, errors } = await retrieveKeyAndEservice(clients, jwt, ctx);
  if (errors) {
    return { data: undefined, errors };
  }

  const { key, eservice: keyEservice, descriptor: keyDescriptor } = data;
  const eservice =
    keyEservice && keyDescriptor
      ? toTokenValidationEService(keyEservice, keyDescriptor)
      : undefined;

  return {
    errors: undefined,
    data: {
      verificationKey: key,
      platformValidationKey: key,
      platformValidationJwt: jwt as unknown as ClientAssertion,
      clientKind: key.clientKind,
      eservice,
      platformStateErrors: buildStartInteractionPlatformErrors({
        clientId: jwt.payload.sub,
        catalogEntry:
          keyEservice && keyDescriptor
            ? toAsyncCatalogValidationContext(keyEservice, keyDescriptor)
            : undefined,
      }),
    },
  };
}

async function retrieveConsumerAsyncValidationContext(
  clients: PagoPAInteropBeClients,
  storage: ToolServiceStorage,
  jwt: AsyncClientAssertion,
  ctx: WithLogger<BffAppContext>
): Promise<
  SuccessfulValidation<AsyncValidationContext> | FailedValidation<string>
> {
  const interactionId = jwt.payload.interactionId;
  if (!interactionId) {
    return {
      data: undefined,
      errors: [
        makeDiagnosticError(
          "interactionIdNotProvided",
          `interactionId not provided in client assertion for client ${jwt.payload.sub}`,
          "interactionId not provided"
        ),
      ],
    };
  }

  const interaction = await readInteractionById(
    storage.dynamoDBClient,
    storage.interactionsTable,
    interactionId
  );
  if (!interaction) {
    return {
      data: undefined,
      errors: [
        makeDiagnosticError(
          "interactionNotFound",
          `Interaction ${interactionId} not found`,
          "Interaction not found"
        ),
      ],
    };
  }

  const scope = jwt.payload.scope as InteractionState;

  if (!isInteractionStateAllowedForScope(interaction.state, scope)) {
    return {
      data: undefined,
      errors: [
        makeDiagnosticError(
          "interactionStateNotAllowed",
          `Interaction ${interactionId} in state ${interaction.state} does not allow scope ${jwt.payload.scope}`,
          "Interaction state not allowed"
        ),
      ],
    };
  }

  const consumerJwt = {
    ...jwt,
    payload: {
      ...jwt.payload,
      purposeId: interaction.purposeId,
    },
  } as unknown as ClientAssertion;

  const { data, errors } = await retrieveKeyAndEservice(
    clients,
    consumerJwt,
    ctx
  );
  if (errors) {
    return { data: undefined, errors };
  }

  if (
    data.key.clientKind !== authorizationApi.ClientKind.enum.CONSUMER ||
    !data.eservice ||
    !data.descriptor
  ) {
    return {
      data: undefined,
      errors: [
        makeDiagnosticError(
          "invalidClientKind",
          `Client ${jwt.payload.sub} is not a consumer client`,
          "Invalid client kind"
        ),
      ],
    };
  }

  const eservice = toTokenValidationEService(data.eservice, data.descriptor);

  return {
    errors: undefined,
    data: {
      verificationKey: data.key,
      platformValidationKey: data.key,
      platformValidationJwt: consumerJwt,
      clientKind: authorizationApi.ClientKind.enum.CONSUMER,
      eservice,
      platformStateErrors: buildConsumerAsyncPlatformErrors(
        jwt,
        interaction,
        toAsyncCatalogValidationContext(data.eservice, data.descriptor)
      ),
    },
  };
}

async function retrieveProducerAsyncValidationContext(
  clients: PagoPAInteropBeClients,
  storage: ToolServiceStorage,
  jwt: AsyncClientAssertion,
  ctx: WithLogger<BffAppContext>
): Promise<
  SuccessfulValidation<AsyncValidationContext> | FailedValidation<string>
> {
  const interactionId = jwt.payload.interactionId;
  if (!interactionId) {
    return {
      data: undefined,
      errors: [
        makeDiagnosticError(
          "interactionIdNotProvided",
          `interactionId not provided in client assertion for client ${jwt.payload.sub}`,
          "interactionId not provided"
        ),
      ],
    };
  }

  const interaction = await readInteractionById(
    storage.dynamoDBClient,
    storage.interactionsTable,
    interactionId
  );
  if (!interaction) {
    return {
      data: undefined,
      errors: [
        makeDiagnosticError(
          "interactionNotFound",
          `Interaction ${interactionId} not found`,
          "Interaction not found"
        ),
      ],
    };
  }

  const scope = jwt.payload.scope as InteractionState;

  if (!isInteractionStateAllowedForScope(interaction.state, scope)) {
    return {
      data: undefined,
      errors: [
        makeDiagnosticError(
          "interactionStateNotAllowed",
          `Interaction ${interactionId} in state ${interaction.state} does not allow scope ${jwt.payload.scope}`,
          "Interaction state not allowed"
        ),
      ],
    };
  }

  const producerKeychainId = unsafeBrandId<ProducerKeychainId>(jwt.payload.sub);
  const [producerKeychain, producerKey, eservice] = await Promise.all([
    clients.authorizationClient.producerKeychain
      .getProducerKeychain({
        params: { producerKeychainId },
        headers: ctx.headers,
      })
      .catch((e) => {
        if (isAxiosError(e) && e.response?.status === 404) {
          return undefined;
        }
        throw e;
      }),
    clients.authorizationClient.producerKeychain
      .getProducerKeyById({
        params: { producerKeychainId, keyId: jwt.header.kid },
        headers: ctx.headers,
      })
      .catch((e) => {
        if (isAxiosError(e) && e.response?.status === 404) {
          return undefined;
        }
        throw e;
      }),
    clients.catalogProcessClient.getEServiceById({
      params: { eServiceId: interaction.eServiceId },
      headers: ctx.headers,
    }),
  ]);

  if (!producerKeychain || !producerKey) {
    return {
      data: undefined,
      errors: [
        makeDiagnosticError(
          "producerKeychainEntryNotFound",
          `Producer keychain entry not found for producer keychain ${producerKeychainId}, key ${jwt.header.kid}, eService ${interaction.eServiceId}`,
          "Producer keychain entry not found"
        ),
      ],
    };
  }

  assertProducerKeychainVisibilityIsFull(producerKeychain);

  if (!producerKeychain.eservices.includes(interaction.eServiceId)) {
    return {
      data: undefined,
      errors: [
        makeDiagnosticError(
          "producerKeychainEServiceNotFound",
          `Producer keychain ${producerKeychainId} is not linked to eService ${interaction.eServiceId}`,
          "Producer keychain eService not found"
        ),
      ],
    };
  }

  const descriptor = await retrieveDescriptor(
    eservice,
    interaction.descriptorId
  );
  const validationCatalogContext = toAsyncCatalogValidationContext(
    eservice,
    descriptor
  );

  return {
    errors: undefined,
    data: {
      verificationKey: { publicKey: producerKey.encodedPem },
      eservice: toTokenValidationEService(eservice, descriptor),
      platformStateErrors: buildProducerAsyncPlatformErrors(
        jwt,
        interaction,
        validationCatalogContext
      ),
    },
  };
}

function assertIsConsumer(
  requesterId: string,
  keyWithClient: authorizationApi.KeyWithClient
) {
  if (requesterId !== keyWithClient.client.consumerId) {
    throw tenantNotAllowed(keyWithClient.client.id);
  }
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

async function retrieveKeyAndEservice(
  {
    authorizationClient,
    purposeProcessClient,
    agreementProcessClient,
    catalogProcessClient,
  }: PagoPAInteropBeClients,
  jwt: ClientAssertion,
  ctx: WithLogger<BffAppContext>
): Promise<
  | SuccessfulValidation<{
      key: TokenGenerationStatesGenericClient;
      eservice?: catalogApi.EService;
      descriptor?: catalogApi.EServiceDescriptor;
    }>
  | FailedValidation<ErrorCodes>
> {
  const keyWithClient = await authorizationClient.token
    .getKeyWithClientByKeyId({
      params: {
        clientId: jwt.payload.sub,
        keyId: jwt.header.kid,
      },
      headers: ctx.headers,
    })
    .catch((e) => {
      if (isAxiosError(e) && e.response?.status === 404) {
        return undefined;
      }
      throw cannotGetKeyWithClient(jwt.payload.sub, jwt.header.kid);
    });

  if (!keyWithClient) {
    return {
      data: undefined,
      errors: [
        clientAssertionPublicKeyNotFound(jwt.header.kid, jwt.payload.sub),
      ],
    };
  }

  assertIsConsumer(ctx.authData.organizationId, keyWithClient);

  const { encodedPem } = await authorizationClient.client.getClientKeyById({
    headers: ctx.headers,
    params: {
      clientId: keyWithClient.client.id,
      keyId: jwt.header.kid,
    },
  });

  if (keyWithClient.client.kind === authorizationApi.ClientKind.enum.API) {
    return {
      errors: undefined,
      data: {
        key: {
          PK: makeTokenGenerationStatesClientKidPK({
            clientId: unsafeBrandId<ClientId>(keyWithClient.client.id),
            kid: jwt.header.kid,
          }),
          clientKind: authorizationApi.ClientKind.enum.API,
          GSIPK_clientId_kid: unsafeBrandId<GSIPKClientIdKid>(jwt.header.kid),
          publicKey: encodedPem,
          GSIPK_clientId: unsafeBrandId<ClientId>(keyWithClient.client.id),
          consumerId: unsafeBrandId<TenantId>(keyWithClient.client.consumerId),
          updatedAt: new Date().toISOString(),
        },
      },
    };
  }

  if (!jwt.payload.purposeId) {
    return {
      data: undefined,
      errors: [purposeIdNotFoundInClientAssertion()],
    };
  }
  const purposeId = unsafeBrandId<PurposeId>(jwt.payload.purposeId);

  const purpose = await purposeProcessClient
    .getPurpose({
      params: { id: purposeId },
      headers: ctx.headers,
    })
    .catch((e) => {
      if (isAxiosError(e) && e.response?.status === 404) {
        return undefined;
      }
      throw e;
    });

  if (!purpose) {
    return {
      data: undefined,
      errors: [purposeNotFound(purposeId)],
    };
  }

  const agreement = await retrieveAgreement(
    agreementProcessClient,
    purpose.consumerId,
    purpose.eserviceId,
    ctx
  );

  const eservice = await catalogProcessClient.getEServiceById({
    params: { eServiceId: agreement.eserviceId },
    headers: ctx.headers,
  });

  const descriptor = await retrieveDescriptor(eservice, agreement.descriptorId);

  return {
    errors: undefined,
    data: {
      key: {
        PK: makeTokenGenerationStatesClientKidPurposePK({
          clientId: unsafeBrandId<ClientId>(keyWithClient.client.id),
          kid: jwt.header.kid,
          purposeId,
        }),
        clientKind: authorizationApi.ClientKind.enum.CONSUMER,
        GSIPK_clientId: unsafeBrandId<ClientId>(keyWithClient.client.id),
        GSIPK_clientId_kid: unsafeBrandId<GSIPKClientIdKid>(jwt.header.kid),
        publicKey: encodedPem,
        GSIPK_purposeId: purposeId,
        consumerId: unsafeBrandId<TenantId>(keyWithClient.client.consumerId),
        agreementId: unsafeBrandId<AgreementId>(agreement.id),
        GSIPK_eserviceId_descriptorId: makeGSIPKEServiceIdDescriptorId({
          eserviceId: unsafeBrandId<EServiceId>(agreement.eserviceId),
          descriptorId: unsafeBrandId<DescriptorId>(agreement.descriptorId),
        }),
        GSIPK_consumerId_eserviceId: makeGSIPKConsumerIdEServiceId({
          eserviceId: unsafeBrandId<EServiceId>(agreement.eserviceId),
          consumerId: unsafeBrandId<TenantId>(keyWithClient.client.consumerId),
        }),
        GSIPK_clientId_purposeId: makeGSIPKClientIdPurposeId({
          clientId: unsafeBrandId<ClientId>(keyWithClient.client.id),
          purposeId,
        }),
        agreementState: agreementStateToItemState(agreement.state),
        purposeState: purposeToItemState(purpose),
        descriptorState: descriptorStateToItemState(descriptor.state),
        descriptorAudience: descriptor.audience,
        descriptorVoucherLifespan: descriptor.voucherLifespan,
        updatedAt: new Date().toISOString(),
      },
      eservice,
      descriptor,
    },
  };
}

async function retrieveAgreement(
  agreementClient: agreementApi.AgreementProcessClient,
  consumerId: string,
  eserviceId: string,
  ctx: WithLogger<BffAppContext>
): Promise<agreementApi.Agreement> {
  const agreements = await getAllAgreements(agreementClient, ctx.headers, {
    consumersIds: [consumerId],
    exactConsumerIdMatch: true,
    eservicesIds: [eserviceId],
    states: [
      agreementApi.AgreementState.Values.ACTIVE,
      agreementApi.AgreementState.Values.SUSPENDED,
      agreementApi.AgreementState.Values.ARCHIVED,
    ],
  });

  if (agreements.length === 0) {
    throw activeAgreementByEserviceAndConsumerNotFound(eserviceId, consumerId);
  }
  if (agreements.length === 1) {
    return agreements[0];
  }

  const agreementPrioritized = agreements.find(
    (a) =>
      a.state === agreementApi.AgreementState.Values.SUSPENDED ||
      a.state === agreementApi.AgreementState.Values.ACTIVE
  );
  return agreementPrioritized ?? agreements[0];
}

async function retrieveDescriptor(
  eservice: catalogApi.EService,
  descriptorId: string
): Promise<catalogApi.EServiceDescriptor> {
  const descriptor = eservice.descriptors.find((d) => d.id === descriptorId);
  if (!descriptor) {
    throw eserviceDescriptorNotFound(eservice.id, descriptorId);
  }

  return descriptor;
}

function purposeToItemState(purpose: purposeApi.Purpose): ItemState {
  const purposeVersion = [...purpose.versions]
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
    .find(
      (v) =>
        v.state === purposeApi.PurposeVersionState.Enum.ACTIVE ||
        v.state === purposeApi.PurposeVersionState.Enum.SUSPENDED ||
        v.state === purposeApi.PurposeVersionState.Enum.ARCHIVED
    );

  if (!purposeVersion) {
    throw missingActivePurposeVersion(purpose.id);
  }

  return purposeVersion.state === purposeApi.PurposeVersionState.Enum.ACTIVE
    ? ItemState.Enum.ACTIVE
    : ItemState.Enum.INACTIVE;
}

function toTokenValidationEService(
  eservice: catalogApi.EService,
  descriptor: catalogApi.EServiceDescriptor
): bffApi.TokenGenerationValidationEService {
  return {
    descriptorId: descriptor.id,
    id: eservice.id,
    name: eservice.name,
    version: descriptor.version,
  };
}

const agreementStateToItemState = (
  state: agreementApi.AgreementState
): ItemState =>
  state === agreementApi.AgreementState.Values.ACTIVE
    ? ItemState.Enum.ACTIVE
    : ItemState.Enum.INACTIVE;

const descriptorStateToItemState = (
  descriptorState: catalogApi.EServiceDescriptorState
): ItemState =>
  descriptorState === catalogApi.EServiceDescriptorState.Enum.PUBLISHED ||
  descriptorState === catalogApi.EServiceDescriptorState.Enum.DEPRECATED
    ? ItemState.Enum.ACTIVE
    : ItemState.Enum.INACTIVE;

function apiErrorsToValidationFailures<T extends string>(
  errors: Array<ApiError<T>> | undefined
): bffApi.TokenGenerationValidationStepFailure[] {
  if (!errors) {
    return [];
  }

  return errors.map((err) => ({
    code: err.code,
    reason: err.message,
  }));
}
