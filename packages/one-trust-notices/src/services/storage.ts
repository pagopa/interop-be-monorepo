import {
  AttributeValue,
  DeleteItemCommandOutput,
  DynamoDB,
  UpdateItemCommandInput,
  UpdateItemCommandOutput,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { DeepPartial, DynamoDBKeyOf } from "../utils/utils.js";

export class DynamoDbTableClient<
  TSchema extends Record<string, unknown> = Record<string, AttributeValue>,
> {
  private client: DynamoDB;

  constructor(
    private tableName: string,
    region: string
  ) {
    this.client = new DynamoDB({ region });
  }

  /**
   * Get all the records in the table.
   *
   * @returns The list of records in the table.
   */
  public async getAll(): Promise<TSchema[]> {
    const result = await this.client.scan({ TableName: this.tableName });
    return (result.Items ?? []).map((item) => unmarshall(item)) as TSchema[];
  }

  /**
   * Get the item with the given key in the given table.
   *
   * @param tableName The name of the table.
   * @param key The key of the item.
   * @returns The item with the given key in the given table.
   * */
  public async getSingle(
    key: DynamoDBKeyOf<TSchema>
  ): Promise<TSchema | undefined> {
    const result = await this.client.getItem({
      TableName: this.tableName,
      Key: marshall(key),
    });
    return result.Item ? (unmarshall(result.Item) as TSchema) : undefined;
  }

  /**
   * Update the item with the given key.
   *
   * @param key The key of the item.
   * @param updateExpression The update expression to use.
   * @returns The result of the update.
   */
  public async updateItem(
    key: DynamoDBKeyOf<TSchema>,
    updatedObj: DeepPartial<TSchema>
  ): Promise<UpdateItemCommandOutput> {
    return await this.client.updateItem({
      TableName: this.tableName,
      Key: marshall(key),
      ...this.generateUpdateExpression(updatedObj),
    });
  }

  /**
   * Delete the item with the given key.
   *
   * @param key The key of the item.
   * @returns The result of the deletion.
   */
  public async deleteItem(
    key: DynamoDBKeyOf<TSchema>
  ): Promise<DeleteItemCommandOutput> {
    return await this.client.deleteItem({
      TableName: this.tableName,
      Key: marshall(key),
    });
  }

  /**
   * This is a helper function that generates the update expression and the expression attribute values based on the given object
   * for the dynamo DB update command.
   *
   * @param updatedObj The object to generate the update expression for.
   * @returns The update expression and the expression attribute values.
   * */
  private generateUpdateExpression(
    updatedObj: DeepPartial<TSchema>
  ): Pick<
    UpdateItemCommandInput,
    "UpdateExpression" | "ExpressionAttributeValues"
  > {
    return {
      UpdateExpression: `SET ${Object.keys(updatedObj)
        .map((key) => `${key} = :${key}`)
        .join(", ")}`
        .replace(/, $/, "")
        .trim(),
      ExpressionAttributeValues: marshall(
        Object.entries(updatedObj).reduce<Record<string, AttributeValue>>(
          (acc, [key, value]) => {
            // eslint-disable-next-line functional/immutable-data
            acc[`:${key}`] = value as AttributeValue;
            return acc;
          },
          {}
        )
      ),
    };
  }
}
