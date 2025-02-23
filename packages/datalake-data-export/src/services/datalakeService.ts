/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { FileManager, Logger } from "pagopa-interop-commons";
import { config } from "../config/config.js";
import {
  getDataCountBucketKey,
  getNdjsonBucketKey,
} from "../utils/helperUtils.js";
import { ReadModelService } from "./readModelService.js";
import { buildDataToExport } from "./dataBuilder.js";

export function datalakeServiceBuilder(
  readModelService: ReadModelService,
  fileManager: FileManager,
  logger: Logger
) {
  return {
    async exportData(): Promise<void> {
      logger.info("Fetching data from read model...");
      const tenants = await readModelService.getTenants();
      const eservices = await readModelService.getEServices();
      const agreements = await readModelService.getAgreements();
      const purposes = await readModelService.getPurposes();

      const exportTimestamp = new Date();
      logger.info("Preparing data for export...");
      const dataToExport = buildDataToExport(
        tenants,
        eservices,
        agreements,
        purposes,
        exportTimestamp
      );

      logger.info(
        `Uploading data to ${config.dataLakeStorageBucket} bucket...`
      );
      for (const [collection, ndjsonFiles, count] of dataToExport) {
        const countBucketKey = getDataCountBucketKey(
          collection,
          exportTimestamp
        );

        const countDataBuffer = Buffer.from(
          JSON.stringify({ count, exportTimestamp })
        );
        await fileManager.storeBytesByKey(
          config.dataLakeStorageBucket,
          countBucketKey,
          countDataBuffer,
          logger
        );
        for (const ndjson of ndjsonFiles) {
          const bucketKey = getNdjsonBucketKey(collection, exportTimestamp);
          await fileManager.storeBytesByKey(
            config.dataLakeStorageBucket,
            bucketKey,
            Buffer.from(ndjson),
            logger
          );
        }
      }
    },
  };
}

export type DatalakeService = ReturnType<typeof datalakeServiceBuilder>;
