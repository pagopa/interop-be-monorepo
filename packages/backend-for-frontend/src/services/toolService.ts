/* eslint-disable @typescript-eslint/explicit-function-return-type */

import { isAxiosError } from "axios";
import { DynamoDBClient, QueryCommand } from "@aws-sdk/client-dynamodb";
import { unmarshall } from "@aws-sdk/util-dynamodb";
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
  Interaction as InteractionSchema,
  InteractionId,
  interactionState,
  InteractionState,
  ItemState,
  makeGSIPKClientIdPurposeId,
  makeGSIPKConsumerIdEServiceId,
  makeGSIPKEServiceIdDescriptorId,
  makeGSIPKInteractionId,
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
import { assertProducerKeychainVisibilityIsFull } from "./validators.js";

type InteractionEntry = {
  PK: string;
  GSIPK_interactionId?: string;
  interactionId: InteractionId;
  purposeId: PurposeId;
  eServiceId: EServiceId;
  descriptorId: DescriptorId;
  state: InteractionState;
  startInteractionTokenIssuedAt?: string;
  callbackInvocationTokenIssuedAt?: string;
  confirmationTokenIssuedAt?: string;
  updatedAt: string;
  ttl: number;
};

type ToolServiceStorage = {
  dynamoDBClient: DynamoDBClient;
  interactionsTable: string;
};

type AsyncCatalogValidationContext = {
  state: ItemState;
  asyncExchange?: boolean;
  asyncExchangeProperties?: catalogApi.AsyncExchangeProperties;
};

type AsyncValidationContext = {
  verificationKey: { publicKey: string };
  platformValidationKey?: TokenGenerationStatesGenericClient;
  platformValidationJwt?: ClientAssertion;
  clientKind?: authorizationApi.ClientKind;
  eservice?: bffApi.TokenGenerationValidationEService;
  platformStateErrors?: Array<ApiError<string>>;
};

const asyncInteractionStateAllowedByScope: Record<
  InteractionState,
  InteractionState[]
> = {
  [interactionState.startInteraction]: [],
  [interactionState.callbackInvocation]: [
    interactionState.startInteraction,
    interactionState.callbackInvocation,
  ],
  [interactionState.getResource]: [
    interactionState.callbackInvocation,
    interactionState.getResource,
  ],
  [interactionState.confirmation]: [
    interactionState.getResource,
    interactionState.confirmation,
  ],
};

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

function validateAsyncScopeClaims(
  jwt: AsyncClientAssertion
): Array<ApiError<string>> | undefined {
  const errors: Array<ApiError<string>> = [];

  switch (jwt.payload.scope) {
    case interactionState.startInteraction:
      if (!jwt.payload.urlCallback) {
        errors.push(
          makeDiagnosticError(
            "urlCallbackNotProvided",
            `urlCallback not provided in client assertion for client ${jwt.payload.sub}`,
            "urlCallback not provided"
          )
        );
      }
      if (!jwt.payload.purposeId) {
        errors.push(
          makeDiagnosticError(
            "purposeIdNotProvided",
            `purposeId not provided in client assertion for client ${jwt.payload.sub}`,
            "purposeId not provided"
          )
        );
      }
      break;
    case interactionState.callbackInvocation:
      if (!jwt.payload.interactionId) {
        errors.push(
          makeDiagnosticError(
            "interactionIdNotProvided",
            `interactionId not provided in client assertion for client ${jwt.payload.sub}`,
            "interactionId not provided"
          )
        );
      }
      if (jwt.payload.entityNumber === undefined) {
        errors.push(
          makeDiagnosticError(
            "entityNumberNotProvided",
            `entityNumber not provided in client assertion for client ${jwt.payload.sub}`,
            "entityNumber not provided"
          )
        );
      }
      break;
    case interactionState.getResource:
    case interactionState.confirmation:
      if (!jwt.payload.interactionId) {
        errors.push(
          makeDiagnosticError(
            "interactionIdNotProvided",
            `interactionId not provided in client assertion for client ${jwt.payload.sub}`,
            "interactionId not provided"
          )
        );
      }
      break;
  }

  return errors.length > 0 ? errors : undefined;
}

async function retrieveAsyncValidationContext(
  clients: PagoPAInteropBeClients,
  storage: ToolServiceStorage,
  jwt: AsyncClientAssertion,
  ctx: WithLogger<BffAppContext>
): Promise<
  SuccessfulValidation<AsyncValidationContext> | FailedValidation<string>
> {
  switch (jwt.payload.scope) {
    case interactionState.startInteraction:
      return retrieveStartInteractionValidationContext(clients, jwt, ctx);
    case interactionState.getResource:
    case interactionState.confirmation:
      return retrieveConsumerAsyncValidationContext(clients, storage, jwt, ctx);
    case interactionState.callbackInvocation:
      return retrieveProducerAsyncValidationContext(clients, storage, jwt, ctx);
  }
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
      platformStateErrors:
        keyEservice?.asyncExchange === true
          ? undefined
          : [
              makeDiagnosticError(
                "asyncExchangeNotEnabled",
                `Async exchange is not enabled for the eService associated with client ${jwt.payload.sub}`,
                "Async exchange not enabled"
              ),
            ],
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

  const descriptor = await retrieveDescriptor(eservice, interaction.descriptorId);
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

async function readInteractionById(
  dynamoDBClient: DynamoDBClient,
  interactionsTable: string,
  interactionId: InteractionId
): Promise<InteractionEntry | undefined> {
  const data = await dynamoDBClient.send(
    new QueryCommand({
      TableName: interactionsTable,
      IndexName: "GSIPK_interactionId-index",
      KeyConditionExpression: "GSIPK_interactionId = :interactionId",
      ExpressionAttributeValues: {
        ":interactionId": { S: makeGSIPKInteractionId(interactionId) },
      },
      Limit: 1,
    })
  );

  const item = data.Items?.[0];
  if (!item) {
    return undefined;
  }

  const parsed = InteractionSchema.safeParse(unmarshall(item));
  if (!parsed.success) {
    throw new Error(
      `Unable to parse interaction entry: ${parsed.error.message}`
    );
  }

  return parsed.data as InteractionEntry;
}

function buildConsumerAsyncPlatformErrors(
  jwt: AsyncClientAssertion,
  interaction: InteractionEntry,
  catalogEntry: AsyncCatalogValidationContext
): Array<ApiError<string>> | undefined {
  const errors: Array<ApiError<string>> = [];

  if (catalogEntry.state !== ItemState.Enum.ACTIVE) {
    errors.push(
      makeDiagnosticError(
        "platformStateValidationFailed",
        `Platform state validation failed - E-Service descriptor state is: ${catalogEntry.state}`,
        "Platform state validation failed"
      )
    );
  }

  if (catalogEntry.asyncExchange !== true) {
    errors.push(
      makeDiagnosticError(
        "asyncExchangeNotEnabled",
        `Async exchange is not enabled for the eService associated with client ${jwt.payload.sub}`,
        "Async exchange not enabled"
      )
    );
  }

  if (!catalogEntry.asyncExchangeProperties) {
    errors.push(
      makeDiagnosticError(
        "platformStateValidationFailed",
        `Platform state validation failed - Missing asyncExchangeProperties for interaction ${interaction.interactionId}`,
        "Platform state validation failed"
      )
    );
    return errors;
  }

  if (!interaction.callbackInvocationTokenIssuedAt) {
    errors.push(
      makeDiagnosticError(
        "callbackInvocationTokenIssuedAtMissing",
        `Interaction ${interaction.interactionId} is missing callbackInvocationTokenIssuedAt timestamp`,
        "Callback invocation token issued at missing"
      )
    );
    return errors;
  }

  const callbackInvocationTokenIssuedAt =
    interaction.callbackInvocationTokenIssuedAt;
  const elapsedMs =
    Date.now() - Date.parse(String(callbackInvocationTokenIssuedAt));
  const resourceAvailableTimeMs =
    catalogEntry.asyncExchangeProperties.resourceAvailableTime * 1000;
  if (elapsedMs >= resourceAvailableTimeMs) {
    errors.push(
      makeDiagnosticError(
        "resourceAvailableTimeExpired",
        `Resource available time expired for interaction ${interaction.interactionId}: elapsed ${elapsedMs / 1000}s exceeds limit of ${catalogEntry.asyncExchangeProperties.resourceAvailableTime}s`,
        "Resource available time expired"
      )
    );
  }

  if (
    jwt.payload.scope === interactionState.confirmation &&
    !catalogEntry.asyncExchangeProperties.confirmation
  ) {
    errors.push(
      makeDiagnosticError(
        "asyncExchangeConfirmationNotEnabled",
        `Async exchange confirmation is not enabled for the eService associated with interaction ${interaction.interactionId}`,
        "Async exchange confirmation not enabled"
      )
    );
  }

  return errors.length > 0 ? errors : undefined;
}

function buildProducerAsyncPlatformErrors(
  jwt: AsyncClientAssertion,
  interaction: InteractionEntry,
  catalogEntry: AsyncCatalogValidationContext
): Array<ApiError<string>> | undefined {
  const errors: Array<ApiError<string>> = [];

  if (catalogEntry.state !== ItemState.Enum.ACTIVE) {
    errors.push(
      makeDiagnosticError(
        "platformStateValidationFailed",
        `Platform state validation failed - E-Service descriptor state is: ${catalogEntry.state}`,
        "Platform state validation failed"
      )
    );
  }

  if (catalogEntry.asyncExchange !== true) {
    errors.push(
      makeDiagnosticError(
        "asyncExchangeNotEnabled",
        `Async exchange is not enabled for the eService associated with client ${jwt.payload.sub}`,
        "Async exchange not enabled"
      )
    );
  }

  if (!catalogEntry.asyncExchangeProperties) {
    errors.push(
      makeDiagnosticError(
        "platformStateValidationFailed",
        `Platform state validation failed - Missing asyncExchangeProperties for interaction ${interaction.interactionId}`,
        "Platform state validation failed"
      )
    );
    return errors;
  }

  if (!interaction.startInteractionTokenIssuedAt) {
    errors.push(
      makeDiagnosticError(
        "platformStateValidationFailed",
        `Platform state validation failed - Interaction ${interaction.interactionId} is missing startInteractionTokenIssuedAt timestamp`,
        "Platform state validation failed"
      )
    );
    return errors;
  }

  const startInteractionTokenIssuedAt =
    interaction.startInteractionTokenIssuedAt;
  const elapsedMs =
    Date.now() - Date.parse(String(startInteractionTokenIssuedAt));
  const responseTimeMs =
    catalogEntry.asyncExchangeProperties.responseTime * 1000;
  if (elapsedMs >= responseTimeMs) {
    errors.push(
      makeDiagnosticError(
        "responseTimeExpired",
        `Response time expired for interaction ${interaction.interactionId}: elapsed ${elapsedMs / 1000}s exceeds limit of ${catalogEntry.asyncExchangeProperties.responseTime}s`,
        "Response time expired"
      )
    );
  }

  return errors.length > 0 ? errors : undefined;
}

function toAsyncCatalogValidationContext(
  eservice: catalogApi.EService,
  descriptor: catalogApi.EServiceDescriptor
): AsyncCatalogValidationContext {
  return {
    state: descriptorStateToItemState(descriptor.state),
    asyncExchange: eservice.asyncExchange,
    asyncExchangeProperties: descriptor.asyncExchangeProperties,
  };
}

function isInteractionStateAllowedForScope(
  currentState: InteractionState,
  scope: InteractionState
): boolean {
  return asyncInteractionStateAllowedByScope[scope].includes(currentState);
}

function makeDiagnosticError(
  code: string,
  detail: string,
  title: string
): ApiError<string> {
  return new ApiError({ code, detail, title });
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
