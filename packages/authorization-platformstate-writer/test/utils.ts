import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  tokenGenerationCommonReadModelServiceBuilder,
  TokenGenerationReadModelRepository,
} from "pagopa-interop-commons";
import { inject } from "vitest";

export const config = inject("tokenGenerationReadModelConfig");

export const configTokenGenerationStates = inject(
  "tokenGenerationReadModelConfig"
);

if (configTokenGenerationStates === undefined) {
  throw new Error("configTokenGenerationStates is undefined");
}

export const dynamoDBClient = new DynamoDBClient({
  endpoint: `http://localhost:${configTokenGenerationStates.tokenGenerationReadModelDbPort}`,
});

const tokenGenerationReadModelRepository =
  TokenGenerationReadModelRepository.init({
    dynamoDBClient,
    platformStatesTableName:
      configTokenGenerationStates.tokenGenerationReadModelTableNamePlatform,
    tokenGenerationStatesTableName:
      configTokenGenerationStates.tokenGenerationReadModelTableNameTokenGeneration,
  });

export const tokenGenerationCommonReadModelService =
  tokenGenerationCommonReadModelServiceBuilder(
    tokenGenerationReadModelRepository
  );
