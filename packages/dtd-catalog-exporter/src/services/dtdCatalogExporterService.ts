/* eslint-disable @typescript-eslint/explicit-function-return-type */

import { FileManager, Logger } from "pagopa-interop-commons";
import { config } from "../config/config.js";
import { toPublicEService } from "../models/converters.js";
import { getAllAttributesIds, getAllTenantsIds } from "../utils/utils.js";
import { readModelServiceBuilder } from "./readModelService.js";

export function dtdCatalogExporterServiceBuilder({
  readModelService,
  fileManager,
  loggerInstance,
}: {
  readModelService: ReturnType<typeof readModelServiceBuilder>;
  fileManager: FileManager;
  loggerInstance: Logger;
}) {
  return {
    async exportDtdPublicCatalog(): Promise<void> {
      loggerInstance.info("Getting e-services from read-model...");
      const eservices = await readModelService.getActiveEServices();

      loggerInstance.info(
        "Getting e-service's tenants and attributes data from database..."
      );
      const eserviceAttributeIds = getAllAttributesIds(eservices);
      const tenantIds = getAllTenantsIds(eservices);

      const attributes = await readModelService.getEServicesAttributes(
        eserviceAttributeIds
      );
      const attributesMap = new Map(attributes.map((attr) => [attr.id, attr]));

      const tenants = await readModelService.getEServicesTenants(tenantIds);
      const tenantsMap = new Map(tenants.map((ten) => [ten.id, ten]));

      loggerInstance.info("Data successfully fetched!\n");

      loggerInstance.info("Remapping e-services to public e-services...\n");
      const publicEServices = eservices.map((eservice) =>
        toPublicEService(eservice, attributesMap, tenantsMap)
      );

      loggerInstance.info("\nUploading result to S3 bucket...");

      await fileManager.storeBytes(
        {
          bucket: config.s3Bucket,
          path: config.dtdCatalogStoragePath,
          name: config.dtdCatalogFilename,
          content: Buffer.from(JSON.stringify(publicEServices)),
        },
        loggerInstance
      );

      loggerInstance.info("\nDone!");
    },
  };
}
