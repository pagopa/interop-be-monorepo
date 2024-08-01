/* eslint-disable @typescript-eslint/explicit-function-return-type */

import {
  DynamoDBClient,
  GetItemCommand,
  PutItemCommand,
  QueryCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { Logger } from "pagopa-interop-commons";
import { dynamoReadingError } from "../model/domain/errors.js";
import { PrivacyNotice, UserPrivacyNotice } from "../model/domain/types.js";

export function privacyNoticeStorageServiceBuilder(
  db: DynamoDBClient,
  privacyNoticesTableName: string,
  privacyNoticesUsersTableName: string
) {
  return {
    async getLatestVersion(
      id: string,
      logger: Logger
    ): Promise<PrivacyNotice | null> {
      logger.info(`Getting id ${id} privacy notice`);

      try {
        const command = new GetItemCommand({
          TableName: privacyNoticesTableName,
          Key: { privacyNoticeId: { S: id } },
        });
        const result = await db.send(command);

        if (result.Item === undefined) {
          return null;
        }
        return unmarshall(result.Item) as PrivacyNotice;
      } catch (error) {
        throw dynamoReadingError(error);
      }
    },

    async getByUserId(
      id: string,
      userId: string,
      logger: Logger
    ): Promise<UserPrivacyNotice | null> {
      logger.info(`Getting privacy notice with id ${id} for user ${userId}`);

      try {
        const command = new QueryCommand({
          TableName: privacyNoticesUsersTableName,
          KeyConditionExpression: "pnIdWithUserId = :pnIdWithUserId",
          ExpressionAttributeValues: {
            ":pnIdWithUserId": { S: `${id}#${userId}` },
          },
        });

        const result = await db.send(command);
        if (!result.Items || result.Items.length === 0) {
          return null;
        }

        const items = result.Items.map(
          (item) => unmarshall(item) as UserPrivacyNotice
        );

        return items.reduce(
          (max, item) =>
            item.version.version > max.version.version ? item : max,
          items[0]
        );
      } catch (error) {
        throw dynamoReadingError(error);
      }
    },

    async put(
      userPrivacyNotice: UserPrivacyNotice,
      logger: Logger
    ): Promise<void> {
      logger.info(
        `Putting ${JSON.stringify(userPrivacyNotice)} privacy notice`
      );

      const command = new PutItemCommand({
        TableName: privacyNoticesUsersTableName,
        Item: marshall(userPrivacyNotice),
      });
      await db.send(command);
    },
  };
}

export type PrivacyNoticeStorage = ReturnType<
  typeof privacyNoticeStorageServiceBuilder
>;
