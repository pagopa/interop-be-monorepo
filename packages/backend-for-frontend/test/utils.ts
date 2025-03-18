import { setupTestContainersVitest } from "pagopa-interop-commons-test/index.js";
import { inject, afterEach } from "vitest";
import { FileManager } from "pagopa-interop-commons";
import { catalogApi, eserviceTemplateApi } from "pagopa-interop-api-clients";
import {
  Descriptor,
  EService,
  EServiceTemplate,
  EServiceTemplateVersion,
} from "pagopa-interop-models";
import {
  EServiceTemplateService,
  eserviceTemplateServiceBuilder,
} from "../src/services/eserviceTemplateService.js";
import {
  AttributeProcessClient,
  EServiceTemplateProcessClient,
  TenantProcessClient,
} from "../src/clients/clientsProvider.js";

export const { cleanup, readModelRepository, postgresDB, fileManager } =
  await setupTestContainersVitest(
    inject("readModelConfig"),
    inject("eventStoreConfig"),
    inject("fileManagerConfig")
  );

afterEach(cleanup);

export const createEServiceTeamplateService = (
  eserviceProcessTemplateClient: EServiceTemplateProcessClient,
  tenantProcessClient: TenantProcessClient,
  attributeProcessClient: AttributeProcessClient,
  fileManager: FileManager
): EServiceTemplateService =>
  eserviceTemplateServiceBuilder(
    eserviceProcessTemplateClient,
    tenantProcessClient,
    attributeProcessClient,
    fileManager
  );

export const toEserviceTemplateProcessMock = (
  eserviceTemplate: EServiceTemplate,
  eserviceTemplateVersion: EServiceTemplateVersion
): eserviceTemplateApi.EServiceTemplate => ({
  ...eserviceTemplate,
  technology: "REST" as const,
  mode: "DELIVER" as const,
  riskAnalysis: [],
  versions: [
    {
      ...eserviceTemplateVersion,
      state: "PUBLISHED" as const,
      suspendedAt: undefined,
      deprecatedAt: undefined,
      publishedAt: new Date().toISOString(),
      agreementApprovalPolicy: undefined,
    },
  ],
});

export const toEserviceCatalogProcessMock = (
  eservice: EService,
  descriptor: Descriptor
): catalogApi.EService => ({
  ...eservice,
  mode: "DELIVER" as const,
  technology: "REST" as const,
  riskAnalysis: [],
  templateRef: eservice.templateRef,
  descriptors: [
    {
      ...descriptor,
      state: "DRAFT",
      version: "1",
      agreementApprovalPolicy: "AUTOMATIC",
      publishedAt: new Date().toISOString(),
      suspendedAt: undefined,
      deprecatedAt: undefined,
      archivedAt: undefined,
      rejectionReasons: undefined,
      templateVersionRef: descriptor.templateVersionRef,
    },
  ],
});
