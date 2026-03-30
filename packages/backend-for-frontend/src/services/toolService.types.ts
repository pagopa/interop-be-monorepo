import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { authorizationApi, bffApi, catalogApi } from "pagopa-interop-api-clients";
import {
  ApiError,
  ClientAssertion,
  ItemState,
  TokenGenerationStatesGenericClient,
} from "pagopa-interop-models";

export type ToolServiceStorage = {
  dynamoDBClient: DynamoDBClient;
  interactionsTable: string;
};

export type AsyncCatalogValidationContext = {
  state: ItemState;
  asyncExchange?: boolean;
  asyncExchangeProperties?: catalogApi.AsyncExchangeProperties;
};

export type AsyncValidationContext = {
  verificationKey: { publicKey: string };
  platformValidationKey?: TokenGenerationStatesGenericClient;
  platformValidationJwt?: ClientAssertion;
  clientKind?: authorizationApi.ClientKind;
  eservice?: bffApi.TokenGenerationValidationEService;
  platformStateErrors?: Array<ApiError<string>>;
};
