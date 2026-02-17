import {
  initFileManager,
  logger,
  withExecutionTime,
} from "pagopa-interop-commons";
import { CorrelationId, generateId } from "pagopa-interop-models";
import { parseAndSanitizeHtml } from "./services/htmlParser.js";
import { OneTrustNoticeDBSchema } from "./models/index.js";

import { config } from "./config/config.js";
import {
  getLatestNoticeBucketPath,
  getNoticeContent,
  getVersionedNoticeBucketPath,
  remapOneTrustNoticeVersionToDynamoDBSchemaUpdateObject,
} from "./utils/utils.js";
import { resolveError } from "./utils/errors.js";
import { ONE_TRUST_NOTICES } from "./utils/consts.js";
import { OneTrustClient } from "./services/oneTrust.js";
import { DynamoDbTableClient } from "./services/storage.js";

const loggerInstance = logger({
  serviceName: "one-trust-notices",
  correlationId: generateId<CorrelationId>(),
});
const fileManager = initFileManager(config);

const dynamoDbTableClient = new DynamoDbTableClient<OneTrustNoticeDBSchema>(
  config.privacyNoticesDynamoTableName,
  config.awsRegion
);

async function main(): Promise<void> {
  loggerInstance.info("Program started.\n");
  loggerInstance.info("> Connecting to OneTrust...");
  const oneTrustClient = await OneTrustClient.connect();

  loggerInstance.info("Connected!\n");

  for (const oneTrustNotice of ONE_TRUST_NOTICES) {
    try {
      loggerInstance.info(`> Getting ${oneTrustNotice.name} data...`);

      const [noticeActiveVersion, ...localizedNoticeContentResponses] =
        await Promise.all([
          // Get the active version of the notice...
          oneTrustClient.getNoticeActiveVersion(oneTrustNotice.id),
          // ... and the localized content for each language.
          ...config.langs.map((lang) =>
            oneTrustClient.getNoticeContent(oneTrustNotice.id, lang)
          ),
        ]);

      // Extracts the notice content for each language.
      const localizedNoticeContents =
        localizedNoticeContentResponses.map(getNoticeContent);

      // Generate the bucket paths for each language.
      const versionedContentBucketPaths = localizedNoticeContents.map(
        (noticeContent, index) =>
          getVersionedNoticeBucketPath(config.langs[index], noticeContent)
      );
      const latestContentBucketPaths = config.langs.map((lang) =>
        getLatestNoticeBucketPath(lang, oneTrustNotice.type)
      );

      loggerInstance.info("> Checking if it is a new version...");

      // We check if there is a new version by checking if the history bucket already has one of the versioned paths.
      const versionedBucketContentList = await fileManager.listFiles(
        config.historyStorageBucket,
        loggerInstance
      );
      const isNewVersion = !versionedContentBucketPaths.some((bucketPath) =>
        versionedBucketContentList.includes(bucketPath)
      );

      if (isNewVersion) {
        loggerInstance.info(`\nNew version found!`);
        loggerInstance.info(
          `> Uploading to ${config.historyStorageBucket} bucket...\n`
        );
        await Promise.all(
          localizedNoticeContentResponses.map((noticeContentResponse, index) =>
            fileManager.storeBytesByKey(
              config.historyStorageBucket,
              versionedContentBucketPaths[index],
              Buffer.from(JSON.stringify(noticeContentResponse)),
              loggerInstance
            )
          )
        );
      } else {
        loggerInstance.info("\nNo new version found.\n");
      }

      loggerInstance.info(
        `> Uploading notice content to ${config.contentStorageBucket} bucket...`
      );

      const jsonHtmlNodes = localizedNoticeContents.map(({ content }) =>
        parseAndSanitizeHtml(content)
      );

      await Promise.all([
        ...jsonHtmlNodes.map((jsonHtmlNode, index) =>
          fileManager.storeBytesByKey(
            config.contentStorageBucket,
            versionedContentBucketPaths[index],
            Buffer.from(JSON.stringify(jsonHtmlNode)),
            loggerInstance
          )
        ),
        ...jsonHtmlNodes.map((jsonHtmlNode, index) =>
          fileManager.storeBytesByKey(
            config.contentStorageBucket,
            latestContentBucketPaths[index],
            Buffer.from(JSON.stringify(jsonHtmlNode)),
            loggerInstance
          )
        ),
      ]);

      loggerInstance.info(
        `> Updating ${oneTrustNotice.name} data in DynamoDB...`
      );

      await dynamoDbTableClient.updateItem(
        { privacyNoticeId: oneTrustNotice.id },
        remapOneTrustNoticeVersionToDynamoDBSchemaUpdateObject(
          noticeActiveVersion
        )
      );

      loggerInstance.info(`Finished ${oneTrustNotice.name}!\n`);
    } catch (error) {
      loggerInstance.info(`Error while processing ${oneTrustNotice.name}:`);
      loggerInstance.info(resolveError(error));
      loggerInstance.info(`Skipping ${oneTrustNotice.name}...\n`);
    }
  }

  loggerInstance.info("Done!.");
}

await withExecutionTime(main, loggerInstance);
