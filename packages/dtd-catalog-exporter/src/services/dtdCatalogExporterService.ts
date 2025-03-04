/* eslint-disable @typescript-eslint/explicit-function-return-type */

import { FileManager, Logger } from "pagopa-interop-commons";
import { config } from "../config/config.js";
import { toPublicEService } from "../models/converters.js";
import { getAllAttributesIds, getAllTenantsIds } from "../utils/utils.js";
import { PublicEService } from "../models/models.js";
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
  const getPublicEServices = async (): Promise<PublicEService[]> => {
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

    return eservices.map((eservice) =>
      toPublicEService(eservice, attributesMap, tenantsMap)
    );
  };

  const convertToCSV = (publicEServices: PublicEService[]) => {
    const headers = [
      "id",
      "name",
      "description",
      "technology",
      "producerId",
      "producerName",
      "attributes",
      "activeDescriptorId",
      "activeDescriptorState",
      "activeDescriptorVersion",
    ].join(",");

    const rows = publicEServices.map((service) =>
      [
        service.id,
        `"${service.name.replace(/"/g, '""')}"`,
        `"${service.description.replace(/"/g, '""') || ""}"`,
        service.technology,
        service.producerId,
        `"${service.producerName.replace(/"/g, '""')}"`,
        `"${JSON.stringify(service.attributes).replace(/"/g, '""')}"`,
        service.activeDescriptor.id,
        service.activeDescriptor.state,
        service.activeDescriptor.version,
      ].join(",")
    );

    return [headers, ...rows].join("\n");
  };

  const convertToJSON = (publicEServices: PublicEService[]) =>
    JSON.stringify(publicEServices);

  return {
    async exportDtdData(): Promise<void> {
      const publicEServices = await getPublicEServices();

      loggerInstance.info("\nUploading JSON result to S3 bucket...");
      const jsonContent = convertToJSON(publicEServices);
      await fileManager.storeBytes(
        {
          bucket: config.s3Bucket,
          path: config.dtdCatalogStoragePath,
          name: config.dtdCatalogJsonFilename,
          content: Buffer.from(jsonContent),
        },
        loggerInstance
      );

      loggerInstance.info("\nUploading CSV result to S3 bucket...");
      const csvContent = convertToCSV(publicEServices);
      await fileManager.storeBytes(
        {
          bucket: config.s3Bucket,
          path: config.dtdCatalogStoragePath,
          name: config.dtdCatalogCsvFilename,
          content: Buffer.from(csvContent),
        },
        loggerInstance
      );

      loggerInstance.info("\nDone!");
    },
  };
}
