import { setupTestContainersVitest } from "pagopa-interop-commons-test";
import { inject, afterEach } from "vitest";
import { catalogApi, eserviceTemplateApi } from "pagopa-interop-api-clients";
import {
  Descriptor,
  EService,
  EServiceTemplate,
  EServiceTemplateVersion,
} from "pagopa-interop-models";

export const { cleanup, readModelRepository, postgresDB, fileManager } =
  await setupTestContainersVitest(
    inject("readModelConfig"),
    inject("eventStoreConfig"),
    inject("fileManagerConfig")
  );

afterEach(cleanup);

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
