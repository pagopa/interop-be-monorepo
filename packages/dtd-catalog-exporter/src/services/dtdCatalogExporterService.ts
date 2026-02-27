/* eslint-disable @typescript-eslint/explicit-function-return-type */

import { FileManager, Logger } from "pagopa-interop-commons";
import { stringify } from "csv-stringify/sync";
import { config } from "../config/config.js";
import { toPublicEService, toPublicTenant } from "../models/converters.js";
import {
  getAllEservicesAttributesIds,
  getAllTenantsAttributesIds,
  getAllTenantsIds,
  sanitizeCsvField,
} from "../utils/utils.js";
import {
  PublicTenant,
  FlattenedPublicEService,
  PublicEService,
  FlattenedPublicTenant,
} from "../models/models.js";
import { GithubClient } from "./github-client.services.js";
import { ReadModelServiceSQL } from "./readModelServiceSQL.js";

export const convertTenantsToCSV = (tenants: PublicTenant[]): string => {
  const records: FlattenedPublicTenant[] = tenants.map((tenant) => ({
    id: tenant.id,
    name: sanitizeCsvField(tenant.name),
    fiscalCode: tenant.fiscalCode,
    ipaCode: tenant.ipaCode,
    attributes: JSON.stringify(tenant.attributes),
  }));

  const columns: Array<keyof FlattenedPublicTenant> = [
    "id",
    "name",
    "fiscalCode",
    "ipaCode",
    "attributes",
  ];

  return stringify(records, { header: true, columns });
};

export const convertEservicesToCSV = (
  publicEServices: PublicEService[]
): string => {
  const records: FlattenedPublicEService[] = publicEServices.map((service) => ({
    id: service.id,
    name: sanitizeCsvField(service.name),
    description: sanitizeCsvField(service.description),
    technology: service.technology,
    producerId: service.producerId,
    producerName: sanitizeCsvField(service.producerName),
    producerFiscalCode: service.producerFiscalCode,
    producerIpaCode: service.producerIpaCode,
    attributes: JSON.stringify(service.attributes),
    activeDescriptorId: service.activeDescriptor.id,
    activeDescriptorState: service.activeDescriptor.state,
    activeDescriptorVersion: service.activeDescriptor.version,
  }));

  const columns: Array<keyof FlattenedPublicEService> = [
    "id",
    "name",
    "description",
    "technology",
    "producerId",
    "producerName",
    "producerFiscalCode",
    "producerIpaCode",
    "attributes",
    "activeDescriptorId",
    "activeDescriptorState",
    "activeDescriptorVersion",
  ];

  return stringify(records, { header: true, columns });
};

export function dtdCatalogExporterServiceBuilder({
  readModelService,
  fileManager,
  loggerInstance,
}: {
  readModelService: ReadModelServiceSQL;
  fileManager: FileManager;
  loggerInstance: Logger;
}) {
  const getPublicEServices = async (): Promise<PublicEService[]> => {
    loggerInstance.info("Getting e-services from read-model...");
    const eservices = await readModelService.getActiveEServices();

    loggerInstance.info(
      "Getting e-service's tenants and attributes data from database..."
    );
    const eservicesTenantsIds = getAllTenantsIds(eservices);
    const eservicesTenants =
      await readModelService.getTenantsByIds(eservicesTenantsIds);
    const eservicesTenantsMap = new Map(
      eservicesTenants.map((ten) => [ten.id, ten])
    );

    const eserviceAttributeIds = getAllEservicesAttributesIds(eservices);
    const eserviceAttributes =
      await readModelService.getAttributes(eserviceAttributeIds);
    const eserviceAttributesMap = new Map(
      eserviceAttributes.map((attr) => [attr.id, attr])
    );

    loggerInstance.info("Data successfully fetched!\n");
    loggerInstance.info("Remapping e-services to public e-services...\n");

    return eservices.map((eservice) =>
      toPublicEService(eservice, eserviceAttributesMap, eservicesTenantsMap)
    );
  };

  const getPublicTenants = async (): Promise<PublicTenant[]> => {
    loggerInstance.info("Getting tenants from read-model...");
    const tenants = await readModelService.getAllTenants();

    loggerInstance.info("Getting tenants' attributes data from database...");
    const tenantAttributesIds = getAllTenantsAttributesIds(tenants);
    const tenantAttributes =
      await readModelService.getAttributes(tenantAttributesIds);
    const tenantAttributesMap = new Map(
      tenantAttributes.map((attr) => [attr.id, attr])
    );

    return tenants.map((tenant) => toPublicTenant(tenant, tenantAttributesMap));
  };

  return {
    async exportDtdData(): Promise<void> {
      const eservices = await getPublicEServices();
      const tenants = await getPublicTenants();

      const githubClient = new GithubClient(config.githubAccessToken);

      // Eservices
      loggerInstance.info("\nUploading Eservices JSON result to S3 bucket...");
      const eservicesJsonContent = JSON.stringify(eservices);
      await fileManager.storeBytes(
        {
          bucket: config.s3Bucket,
          path: config.dtdCatalogStoragePath,
          name: config.dtdCatalogJsonFilename,
          content: Buffer.from(eservicesJsonContent),
        },
        loggerInstance
      );

      loggerInstance.info(
        "\nUploading Eservices JSON result to GitHub repo..."
      );
      await githubClient.createOrUpdateRepoFile(
        eservicesJsonContent,
        config.githubRepoOwner,
        config.githubRepo,
        `data/${config.dtdCatalogJsonFilename}`
      );

      loggerInstance.info("\nUploading Eservices CSV result to GitHub repo...");
      const eservicesCsvContent = convertEservicesToCSV(eservices);
      await githubClient.createOrUpdateRepoFile(
        eservicesCsvContent,
        config.githubRepoOwner,
        config.githubRepo,
        `data/${config.dtdCatalogCsvFilename}`
      );

      // Tenants
      loggerInstance.info("\nUploading Tenants JSON result to GitHub repo...");
      const tenantsJsonContent = JSON.stringify(tenants);
      await githubClient.createOrUpdateRepoFile(
        tenantsJsonContent,
        config.githubRepoOwner,
        config.githubRepo,
        `data/${config.dtdTenantsJsonFilename}`
      );

      loggerInstance.info("\nUploading Tenants CSV result to GitHub repo...");
      const tenantsCsvContent = convertTenantsToCSV(tenants);
      await githubClient.createOrUpdateRepoFile(
        tenantsCsvContent,
        config.githubRepoOwner,
        config.githubRepo,
        `data/${config.dtdTenantsCsvFilename}`
      );

      loggerInstance.info("\nDone!");
    },
  };
}
