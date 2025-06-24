import { setupTestContainersVitest } from "pagopa-interop-commons-test";
import { inject, afterEach } from "vitest";
import {
  AppContext,
  FileManager,
  genericLogger,
  UIAuthData,
  WithLogger,
} from "pagopa-interop-commons";
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
  CatalogProcessClient,
  EServiceTemplateProcessClient,
  TenantProcessClient,
} from "../src/clients/clientsProvider.js";
import { BffAppContext } from "../src/utilities/context.js";

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
  catalogProcessClient: CatalogProcessClient,
  fileManager: FileManager
): EServiceTemplateService =>
  eserviceTemplateServiceBuilder(
    eserviceProcessTemplateClient,
    tenantProcessClient,
    attributeProcessClient,
    catalogProcessClient,
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
  templateId: eservice.templateId,
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

export const getBffMockContext = (
  ctx: AppContext<UIAuthData>
): WithLogger<BffAppContext> => ({
  ...ctx,
  headers: {
    "X-Correlation-Id": ctx.correlationId,
    Authorization: "authorization",
    "X-Forwarded-For": "x-forwarded-for",
  },
  logger: genericLogger,
});
