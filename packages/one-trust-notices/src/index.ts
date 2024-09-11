/* eslint-disable no-console */

import { genericLogger, initFileManager } from "pagopa-interop-commons";
import { html2json } from "./services/html2json.js";
import { OneTrustNoticeDBSchema } from "./models/index.js";

import { config } from "./config/config.js";
import {
  getLatestNoticeBucketPath,
  getNoticeContent,
  getVersionedNoticeBucketPath,
  remapOneTrustNoticeVersionToDynamoDBSchemaUpdateObject,
  withExecutionTime,
} from "./utils/utils.js";
import { resolveError } from "./utils/errors.js";
import { ONE_TRUST_NOTICES } from "./utils/consts.js";
import { OneTrustClient } from "./services/oneTrust.js";
import { DynamoDbTableClient } from "./services/storage.js";

const logger = genericLogger;
const fileManager = initFileManager(config);

const dynamoDbTableClient = new DynamoDbTableClient<OneTrustNoticeDBSchema>(
  config.PRIVACY_NOTICES_DYNAMO_TABLE_NAME,
  config.AWS_REGION
);

async function main(): Promise<void> {
  logger.info("Program started.\n");
  logger.info("> Connecting to OneTrust...");
  const oneTrustClient = await OneTrustClient.connect();

  logger.info("Connected!\n");

  for (const oneTrustNotice of ONE_TRUST_NOTICES) {
    try {
      logger.info(`> Getting ${oneTrustNotice.name} data...`);

      const [noticeActiveVersion, ...localizedNoticeContentResponses] =
        await Promise.all([
          // Get the active version of the notice...
          oneTrustClient.getNoticeActiveVersion(oneTrustNotice.id),
          // ... and the localized content for each language.
          ...config.LANGS.map((lang) =>
            oneTrustClient.getNoticeContent(oneTrustNotice.id, lang)
          ),
        ]);

      // Extracts the notice content for each language.
      const localizedNoticeContents =
        localizedNoticeContentResponses.map(getNoticeContent);

      // Generate the bucket paths for each language.
      const versionedContentBucketPaths = localizedNoticeContents.map(
        (noticeContent, index) =>
          getVersionedNoticeBucketPath(config.LANGS[index], noticeContent)
      );
      const latestContentBucketPaths = config.LANGS.map((lang) =>
        getLatestNoticeBucketPath(lang, oneTrustNotice.type)
      );

      logger.info("> Checking if it is a new version...");

      // We check if there is a new version by checking if the history bucket already has one of the versioned paths.
      const versionedBucketContentList = await fileManager.listFiles(
        config.HISTORY_STORAGE_BUCKET,
        logger
      );
      const isNewVersion = !versionedContentBucketPaths.some((bucketPath) =>
        versionedBucketContentList.includes(bucketPath)
      );

      if (isNewVersion) {
        logger.info(`\nNew version found!`);
        logger.info(
          `> Uploading to ${config.HISTORY_STORAGE_BUCKET} bucket...\n`
        );
        await Promise.all(
          localizedNoticeContentResponses.map((noticeContentResponse, index) =>
            fileManager.storeBytesByPath(
              config.HISTORY_STORAGE_BUCKET,
              versionedContentBucketPaths[index],
              Buffer.from(JSON.stringify(noticeContentResponse)),
              logger
            )
          )
        );
      } else {
        logger.info("\nNo new version found.\n");
      }

      logger.info(
        `> Uploading notice content to ${config.CONTENT_STORAGE_BUCKET} bucket...`
      );

      const jsonHtmlNodes = localizedNoticeContents.map(({ content }) =>
        html2json(content)
      );

      await Promise.all([
        ...jsonHtmlNodes.map((jsonHtmlNode, index) =>
          fileManager.storeBytesByPath(
            config.CONTENT_STORAGE_BUCKET,
            versionedContentBucketPaths[index],
            Buffer.from(JSON.stringify(jsonHtmlNode)),
            logger
          )
        ),
        ...jsonHtmlNodes.map((jsonHtmlNode, index) =>
          fileManager.storeBytesByPath(
            config.CONTENT_STORAGE_BUCKET,
            latestContentBucketPaths[index],
            Buffer.from(JSON.stringify(jsonHtmlNode)),
            logger
          )
        ),
      ]);

      logger.info(`> Updating ${oneTrustNotice.name} data in DynamoDB...`);

      await dynamoDbTableClient.updateItem(
        { privacyNoticeId: oneTrustNotice.id },
        remapOneTrustNoticeVersionToDynamoDBSchemaUpdateObject(
          noticeActiveVersion
        )
      );

      logger.info(`Finished ${oneTrustNotice.name}!\n`);
    } catch (error) {
      logger.info(`Error while processing ${oneTrustNotice.name}:`);
      logger.info(resolveError(error));
      logger.info(`Skipping ${oneTrustNotice.name}...\n`);
    }
  }

  logger.info("Done!.");
}

await withExecutionTime(main);
