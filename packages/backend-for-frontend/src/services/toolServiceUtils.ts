import {
  AttributeValue,
  DynamoDBClient,
  GetItemCommand,
  QueryCommand,
} from "@aws-sdk/client-dynamodb";
import { unmarshall } from "@aws-sdk/util-dynamodb";
import { catalogApi } from "pagopa-interop-api-clients";
import {
  ApiError,
  AsyncClientAssertion,
  ClientAssertion,
  Interaction,
  InteractionId,
  interactionState,
  InteractionState,
  ItemState,
  makeGSIPKInteractionId,
  makeInteractionPK,
} from "pagopa-interop-models";
import { match } from "ts-pattern";
import {
  AsyncCatalogValidationContext,
  RetrievedInteractionValidationResult,
} from "./toolService.types.js";

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

export function validateAsyncScopeClaims(
  jwt: AsyncClientAssertion
): Array<ApiError<string>> | undefined {
  const errors = match(jwt.payload.scope)
    .with(interactionState.startInteraction, () => [
      !jwt.payload.urlCallback
        ? makeDiagnosticError(
            "urlCallbackNotProvided",
            `urlCallback not provided in client assertion for client ${jwt.payload.sub}`,
            "urlCallback not provided"
          )
        : undefined,
      !jwt.payload.purposeId
        ? makeDiagnosticError(
            "purposeIdNotProvided",
            `purposeId not provided in client assertion for client ${jwt.payload.sub}`,
            "purposeId not provided"
          )
        : undefined,
    ])
    .with(interactionState.callbackInvocation, () => [
      !jwt.payload.interactionId
        ? makeDiagnosticError(
            "interactionIdNotProvided",
            `interactionId not provided in client assertion for client ${jwt.payload.sub}`,
            "interactionId not provided"
          )
        : undefined,
      jwt.payload.entityNumber === undefined
        ? makeDiagnosticError(
            "entityNumberNotProvided",
            `entityNumber not provided in client assertion for client ${jwt.payload.sub}`,
            "entityNumber not provided"
          )
        : undefined,
      jwt.payload.entityNumber !== undefined && jwt.payload.entityNumber <= 0
        ? makeDiagnosticError(
            "invalidEntityNumber",
            `entityNumber ${jwt.payload.entityNumber} is not valid for client ${jwt.payload.sub} - must be greater than 0`,
            "Invalid entityNumber"
          )
        : undefined,
    ])
    .with(interactionState.getResource, interactionState.confirmation, () => [
      !jwt.payload.interactionId
        ? makeDiagnosticError(
            "interactionIdNotProvided",
            `interactionId not provided in client assertion for client ${jwt.payload.sub}`,
            "interactionId not provided"
          )
        : undefined,
    ])
    .exhaustive()
    .filter((error): error is ApiError<string> => error !== undefined);

  return errors.length > 0 ? errors : undefined;
}

export function toClientAssertion(
  jwt: AsyncClientAssertion,
  purposeId: ClientAssertion["payload"]["purposeId"] = jwt.payload.purposeId
): ClientAssertion {
  return {
    header: jwt.header,
    payload: {
      sub: jwt.payload.sub,
      jti: jwt.payload.jti,
      iat: jwt.payload.iat,
      iss: jwt.payload.iss,
      aud: jwt.payload.aud,
      exp: jwt.payload.exp,
      digest: jwt.payload.digest,
      purposeId,
    },
  };
}

export async function readInteractionById(
  dynamoDBClient: DynamoDBClient,
  interactionsTable: string,
  interactionId: InteractionId
): Promise<Interaction | undefined> {
  const queryResult = await dynamoDBClient.send(
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

  const queryItem = queryResult.Items?.[0];
  if (queryItem) {
    return parseInteraction(queryItem);
  }

  const fallbackResult = await dynamoDBClient.send(
    new GetItemCommand({
      TableName: interactionsTable,
      Key: {
        PK: { S: makeInteractionPK(interactionId) },
      },
      ConsistentRead: true,
    })
  );

  return fallbackResult.Item
    ? parseInteraction(fallbackResult.Item)
    : undefined;
}

export async function retrieveInteractionForAsyncScope(
  dynamoDBClient: DynamoDBClient,
  interactionsTable: string,
  jwt: AsyncClientAssertion
): Promise<RetrievedInteractionValidationResult> {
  const interactionId = jwt.payload.interactionId;
  if (!interactionId) {
    return {
      interaction: undefined,
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
    dynamoDBClient,
    interactionsTable,
    interactionId
  );
  if (!interaction) {
    return {
      interaction: undefined,
      errors: [
        makeDiagnosticError(
          "interactionNotFound",
          `Interaction ${interactionId} not found`,
          "Interaction not found"
        ),
      ],
    };
  }

  if (!isInteractionStateAllowedForScope(interaction.state, jwt.payload.scope)) {
    return {
      interaction: undefined,
      errors: [
        makeDiagnosticError(
          "interactionStateNotAllowed",
          `Interaction ${interactionId} in state ${interaction.state} does not allow scope ${jwt.payload.scope}`,
          "Interaction state not allowed"
        ),
      ],
    };
  }

  return { interaction, errors: undefined };
}

export function buildStartInteractionPlatformErrors({
  clientId,
  catalogEntry,
}: {
  clientId: string;
  catalogEntry?: AsyncCatalogValidationContext;
}): Array<ApiError<string>> | undefined {
  if (!catalogEntry) {
    return undefined;
  }

  const errors: Array<ApiError<string>> = [];

  if (catalogEntry.asyncExchange !== true) {
    errors.push(
      makeDiagnosticError(
        "asyncExchangeNotEnabled",
        `Async exchange is not enabled for the eService associated with client ${clientId}`,
        "Async exchange not enabled"
      )
    );
  }

  if (!catalogEntry.asyncExchangeProperties) {
    errors.push(
      makeDiagnosticError(
        "platformStateValidationFailed",
        `Platform state validation failed - Missing asyncExchangeProperties for client ${clientId}`,
        "Platform state validation failed"
      )
    );
  }

  return errors.length > 0 ? errors : undefined;
}

export function buildConsumerAsyncPlatformErrors(
  jwt: AsyncClientAssertion,
  interaction: Interaction,
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

  const elapsedMs =
    Date.now() -
    Date.parse(String(interaction.callbackInvocationTokenIssuedAt));
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

export function buildProducerAsyncPlatformErrors(
  jwt: AsyncClientAssertion,
  interaction: Interaction,
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

  const elapsedMs =
    Date.now() - Date.parse(String(interaction.startInteractionTokenIssuedAt));
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

export function toAsyncCatalogValidationContext(
  eservice: catalogApi.EService,
  descriptor: catalogApi.EServiceDescriptor
): AsyncCatalogValidationContext {
  return {
    state:
      descriptor.state === catalogApi.EServiceDescriptorState.Enum.PUBLISHED ||
      descriptor.state === catalogApi.EServiceDescriptorState.Enum.DEPRECATED
        ? ItemState.Enum.ACTIVE
        : ItemState.Enum.INACTIVE,
    asyncExchange: eservice.asyncExchange,
    asyncExchangeProperties: descriptor.asyncExchangeProperties,
  };
}

export function isInteractionStateAllowedForScope(
  currentState: InteractionState,
  scope: InteractionState
): boolean {
  return asyncInteractionStateAllowedByScope[scope].includes(currentState);
}

export function makeDiagnosticError(
  code: string,
  detail: string,
  title: string
): ApiError<string> {
  return new ApiError({ code, detail, title });
}

const parseInteraction = (
  item: Record<string, AttributeValue>
): Interaction => {
  const parsed = Interaction.safeParse(unmarshall(item));
  if (!parsed.success) {
    throw new Error(
      `Unable to parse interaction entry: ${parsed.error.message}`
    );
  }

  return parsed.data;
};
