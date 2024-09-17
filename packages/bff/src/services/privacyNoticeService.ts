/* eslint-disable @typescript-eslint/explicit-function-return-type */

import { FileManager, Logger } from "pagopa-interop-commons";
import { bffApi } from "pagopa-interop-api-clients";
import {
  privacyNoticeNotFoundInConfiguration,
  privacyNoticeNotFound,
  privacyNoticeVersionIsNotTheLatest,
} from "../model/domain/errors.js";
import { UserPrivacyNotice } from "../model/domain/types.js";
import { config } from "../config/config.js";
import { PrivacyNoticeStorage } from "./privacyNoticeStorage.js";

export function privacyNoticeServiceBuilder(
  privacyNoticeStorage: PrivacyNoticeStorage,
  fileManager: FileManager,
  consentTypeMap: Map<bffApi.ConsentType, string>
) {
  return {
    async getPrivacyNotice(
      consentType: bffApi.ConsentType,
      userId: string,
      logger: Logger
    ): Promise<bffApi.PrivacyNotice> {
      logger.info(`Retrieving privacy notice for consentType ${consentType}`);

      const privacyNoticeId = retrievePrivacyNoticeId(
        consentType,
        consentTypeMap
      );

      const latest = await retrieveLatestPrivacyNoticeVersion(
        consentType,
        privacyNoticeId,
        privacyNoticeStorage,
        logger
      );

      const userPrivacyNotice = await privacyNoticeStorage.getByUserId(
        privacyNoticeId,
        userId,
        logger
      );
      if (!userPrivacyNotice) {
        return {
          id: privacyNoticeId,
          userId,
          consentType,
          firstAccept: false,
          isUpdated: false,
          latestVersionId: latest.privacyNoticeVersion.versionId,
        };
      }

      return {
        consentType,
        userId,
        firstAccept: true,
        id: privacyNoticeId,
        isUpdated:
          latest.privacyNoticeVersion.version ===
          userPrivacyNotice.version.version,
        latestVersionId: latest.privacyNoticeVersion.versionId,
      };
    },

    async acceptPrivacyNotice(
      consentType: bffApi.ConsentType,
      userId: string,
      seed: bffApi.PrivacyNoticeSeed,
      logger: Logger
    ): Promise<void> {
      logger.info(`Accept privacy notices for consentType ${consentType}`);

      const privacyNoticeId = retrievePrivacyNoticeId(
        consentType,
        consentTypeMap
      );

      const latest = await retrieveLatestPrivacyNoticeVersion(
        consentType,
        privacyNoticeId,
        privacyNoticeStorage,
        logger
      );

      if (latest.privacyNoticeVersion.versionId !== seed.latestVersionId) {
        throw privacyNoticeVersionIsNotTheLatest(seed.latestVersionId);
      }

      const userPrivacyNotice = await privacyNoticeStorage.getByUserId(
        privacyNoticeId,
        userId,
        logger
      );

      if (
        userPrivacyNotice?.versionNumber === latest.privacyNoticeVersion.version
      ) {
        return;
      }

      const privacyNotice: UserPrivacyNotice = {
        pnIdWithUserId: `${privacyNoticeId}#${userId}`,
        privacyNoticeId,
        userId,
        versionNumber: latest.privacyNoticeVersion.version,
        acceptedAt: new Date().toISOString(),
        version: {
          version: latest.privacyNoticeVersion.version,
          versionId: seed.latestVersionId,
          kind: consentType,
        },
      };
      await privacyNoticeStorage.put(privacyNotice, logger);
    },

    async getPrivacyNoticeContent(
      consentType: bffApi.ConsentType,
      logger: Logger
    ): Promise<Buffer> {
      logger.info(
        `Retrieving privacy notice content for consentType ${consentType}`
      );

      const privacyNoticeId = retrievePrivacyNoticeId(
        consentType,
        consentTypeMap
      );

      const latest = await retrieveLatestPrivacyNoticeVersion(
        consentType,
        privacyNoticeId,
        privacyNoticeStorage,
        logger
      );

      const path = `${config.privacyNoticesPath}/${latest.privacyNoticeVersion.versionId}/it/${config.privacyNoticesFileName}`;
      const bytes = await fileManager.get(
        config.privacyNoticesContainer,
        path,
        logger
      );
      return Buffer.from(bytes);
    },
  };
}

function retrievePrivacyNoticeId(
  consentType: bffApi.ConsentType,
  consentTypeMap: Map<bffApi.ConsentType, string>
) {
  const privacyNoticeId = consentTypeMap.get(consentType);
  if (!privacyNoticeId) {
    throw privacyNoticeNotFoundInConfiguration(consentType);
  }
  return privacyNoticeId;
}

async function retrieveLatestPrivacyNoticeVersion(
  consentType: bffApi.ConsentType,
  privacyNoticeId: string,
  privacyNoticeStorage: PrivacyNoticeStorage,
  logger: Logger
) {
  const latest = await privacyNoticeStorage.getLatestVersion(
    privacyNoticeId,
    logger
  );

  if (!latest) {
    throw privacyNoticeNotFound(consentType);
  }
  return latest;
}