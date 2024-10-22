import { DynamoDBClient } from "@aws-sdk/client-dynamodb";

export class TokenGenerationReadModelRepository {
  private static instance: TokenGenerationReadModelRepository;

  public dynamoDBClient: DynamoDBClient;

  public platformStatesTableName: string;

  public tokenGenerationStatesTableName: string;

  private constructor({
    dynamoDBClient,
    platformStatesTableName,
    tokenGenerationStatesTableName,
  }: {
    dynamoDBClient: DynamoDBClient;
    platformStatesTableName: string;
    tokenGenerationStatesTableName: string;
  }) {
    this.dynamoDBClient = dynamoDBClient;
    this.platformStatesTableName = platformStatesTableName;
    this.tokenGenerationStatesTableName = tokenGenerationStatesTableName;
  }

  public static init({
    dynamoDBClient,
    platformStatesTableName,
    tokenGenerationStatesTableName,
  }: {
    dynamoDBClient: DynamoDBClient;
    platformStatesTableName: string;
    tokenGenerationStatesTableName: string;
  }): TokenGenerationReadModelRepository {
    if (!TokenGenerationReadModelRepository.instance) {
      // eslint-disable-next-line functional/immutable-data
      TokenGenerationReadModelRepository.instance =
        new TokenGenerationReadModelRepository({
          dynamoDBClient,
          platformStatesTableName,
          tokenGenerationStatesTableName,
        });
    }

    return TokenGenerationReadModelRepository.instance;
  }
}
