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
  ApiError,
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
      docs: eserviceTemplateVersion.docs.map((doc) => ({
        ...doc,
        uploadDate: new Date(doc.uploadDate).toISOString(),
      })),
      interface: eserviceTemplateVersion.interface
        ? {
            ...eserviceTemplateVersion.interface,
            uploadDate: new Date(
              eserviceTemplateVersion.interface.uploadDate
            ).toISOString(),
          }
        : undefined,
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
      docs: descriptor.docs.map((doc) => ({
        ...doc,
        uploadDate: new Date(doc.uploadDate).toISOString(),
      })),
      interface: descriptor.interface
        ? {
            ...descriptor.interface,
            uploadDate: new Date(descriptor.interface.uploadDate).toISOString(),
          }
        : undefined,
      serverUrls: [],
      state: "DRAFT",
      version: 1,
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

const catalogErrorCodes = {
  eserviceTemplateInterfaceNotFound: "0035",
  eserviceTemplateInterfaceDataNotValid: "0036",
};
export type CatalogErrorCodes = keyof typeof catalogErrorCodes;

export function eserviceTemplateInterfaceNotFound(
  eserviceTemplateId: string,
  eserviceTemplateVersionId: string
): ApiError<CatalogErrorCodes> {
  return new ApiError({
    detail: `EService template interface for template ${eserviceTemplateId} with version ${eserviceTemplateVersionId} not found`,
    code: "eserviceTemplateInterfaceNotFound",
    title: "EService template interface document not found",
  });
}

export function eserviceInterfaceDataNotValid(): ApiError<CatalogErrorCodes> {
  return new ApiError({
    detail: `EService template interface data not valid`,
    code: "eserviceTemplateInterfaceDataNotValid",
    title: "EService template interface data not valid",
  });
}
