/* eslint-disable @typescript-eslint/explicit-function-return-type */

import { FileManager, Logger } from "pagopa-interop-commons";
import { stringify } from "csv-stringify/sync";
import { config } from "../config/config.js";
import { toPublicEService } from "../models/converters.js";
import { getAllAttributesIds, getAllTenantsIds } from "../utils/utils.js";
import { FlattenedPublicEService, PublicEService } from "../models/models.js";
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

  const convertToCSV = (publicEServices: PublicEService[]): string => {
    const records: FlattenedPublicEService[] = publicEServices.map(
      (service) => ({
        id: service.id,
        name: service.name,
        description: service.description,
        technology: service.technology,
        producerId: service.producerId,
        producerName: service.producerName,
        producerExternalId: service.producerExternalId,
        attributes: JSON.stringify(service.attributes),
        activeDescriptorId: service.activeDescriptor.id,
        activeDescriptorState: service.activeDescriptor.state,
        activeDescriptorVersion: service.activeDescriptor.version,
      })
    );

    const columns: Array<keyof FlattenedPublicEService> = [
      "id",
      "name",
      "description",
      "technology",
      "producerId",
      "producerName",
      "producerExternalId",
      "attributes",
      "activeDescriptorId",
      "activeDescriptorState",
      "activeDescriptorVersion",
    ];

    return stringify(records, { header: true, columns });
  };

  const convertToJSON = (publicEServices: PublicEService[]): string =>
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
