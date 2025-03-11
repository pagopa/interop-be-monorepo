/* eslint-disable @typescript-eslint/explicit-function-return-type */

import { FileManager, Logger } from "pagopa-interop-commons";
import { stringify } from "csv-stringify/sync";
import { config } from "../config/config.js";
import { toPublicEService, toPublicTenant } from "../models/converters.js";
import {
  getAllEservicesAttributesIds,
  getAllTenantsIds,
} from "../utils/utils.js";
import {
  PublicTenant,
  FlattenedPublicEService,
  PublicEService,
  FlattenedPublicTenant,
} from "../models/models.js";
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
  const getPublicEServicesAndTenants = async (): Promise<{
    eservices: PublicEService[];
    tenants: PublicTenant[];
  }> => {
    loggerInstance.info("Getting e-services from read-model...");
    const eservices = await readModelService.getActiveEServices();

    loggerInstance.info(
      "Getting e-service's tenants and attributes data from database..."
    );
    const eserviceAttributeIds = getAllEservicesAttributesIds(eservices);
    const tenantIds = getAllTenantsIds(eservices);

    const attributes = await readModelService.getAttributes(
      eserviceAttributeIds
    );
    const attributesMap = new Map(attributes.map((attr) => [attr.id, attr]));

    const tenants = await readModelService.getEServicesTenants(tenantIds);
    const tenantsMap = new Map(tenants.map((ten) => [ten.id, ten]));

    loggerInstance.info("Data successfully fetched!\n");
    loggerInstance.info("Remapping e-services to public e-services...\n");

    const publicEservices = eservices.map((eservice) =>
      toPublicEService(eservice, attributesMap, tenantsMap)
    );

    const publicTenants = await Promise.all(
      Array.from(tenantsMap.values()).map(
        async (tenant) => await toPublicTenant(tenant, readModelService)
      )
    );

    return {
      eservices: publicEservices,
      tenants: publicTenants,
    };
  };

  const convertTenantsToCSV = (tenants: PublicTenant[]): string => {
    const records: FlattenedPublicTenant[] = tenants.map((tenant) => ({
      id: tenant.id,
      name: tenant.name,
      externalId: tenant.externalId,
      attributes: JSON.stringify(tenant.attributes),
    }));

    const columns: Array<keyof FlattenedPublicTenant> = [
      "id",
      "name",
      "externalId",
      "attributes",
    ];

    return stringify(records, { header: true, columns });
  };

  const convertEservicesToCSV = (publicEServices: PublicEService[]): string => {
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

  const convertEservicesToJSON = (publicEServices: PublicEService[]): string =>
    JSON.stringify(publicEServices);

  return {
    async exportDtdData(): Promise<void> {
      const { eservices, tenants } = await getPublicEServicesAndTenants();

      loggerInstance.info("\nUploading Eservices JSON result to S3 bucket...");
      const eservicesJsonContent = convertEservicesToJSON(eservices);
      await fileManager.storeBytes(
        {
          bucket: config.s3Bucket,
          path: config.dtdCatalogStoragePath,
          name: config.dtdCatalogJsonFilename,
          content: Buffer.from(eservicesJsonContent),
        },
        loggerInstance
      );

      loggerInstance.info("\nUploading Eservices CSV result to S3 bucket...");
      const eservicesCsvContent = convertEservicesToCSV(eservices);
      await fileManager.storeBytes(
        {
          bucket: config.s3Bucket,
          path: config.dtdCatalogStoragePath,
          name: config.dtdCatalogCsvFilename,
          content: Buffer.from(eservicesCsvContent),
        },
        loggerInstance
      );

      loggerInstance.info("\nUploading Tenants CSV result to S3 bucket...");
      const tenantsCsvContent = convertTenantsToCSV(tenants);
      await fileManager.storeBytes(
        {
          bucket: config.s3Bucket,
          path: config.dtdCatalogStoragePath,
          name: config.dtdTenantsCsvFilename,
          content: Buffer.from(tenantsCsvContent),
        },
        loggerInstance
      );

      loggerInstance.info("\nDone!");
    },
  };
}
