import {
  getMockValidRiskAnalysis,
  getMockValidRiskAnalysisForm,
  setupTestContainersVitest,
} from "pagopa-interop-commons-test";
import {
  EService,
  EServiceTemplate,
  Purpose,
  TenantId,
  TenantKind,
  tenantKind,
} from "pagopa-interop-models";
import { afterEach, inject } from "vitest";
import {
  upsertEService,
  upsertEServiceTemplate,
  upsertPurpose,
} from "pagopa-interop-readmodel/testUtils";
import { readModelServiceBuilderSQL } from "../src/services/readModelServiceSQL.js";
import { tenantKindHistory } from "pagopa-interop-tenant-kind-history-db-models";

const config = inject("readModelSQLConfig");

export const { cleanup, readModelDB, tenantKindHistoryDB } =
  await setupTestContainersVitest(
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    inject("readModelSQLConfig"),
    undefined,
    undefined,
    undefined,
    inject("tenantKindHistoryDBConfig")
  );

afterEach(cleanup);

if (!config) {
  throw new Error("Config is not defined");
}

export const readModelService = readModelServiceBuilderSQL(
  readModelDB,
  tenantKindHistoryDB
);

export const addOneEService = async (eservice: EService): Promise<void> => {
  await upsertEService(readModelDB, eservice, 0);
};

export const addOnePurpose = async (purpose: Purpose): Promise<void> => {
  await upsertPurpose(readModelDB, purpose, 0);
};

export const addOneEServiceTemplate = async (
  eserviceTemplate: EServiceTemplate
): Promise<void> => {
  await upsertEServiceTemplate(readModelDB, eserviceTemplate, 0);
};

export const addOneTenantKindHistoryEntry = async ({
  tenantId,
  metadataVersion,
  kind,
  modifiedAt,
}: {
  tenantId: TenantId;
  metadataVersion: number;
  kind: TenantKind;
  modifiedAt: Date;
}): Promise<void> => {
  await tenantKindHistoryDB.insert(tenantKindHistory).values({
    tenantId,
    metadataVersion,
    kind,
    modifiedAt: modifiedAt.toISOString(),
  });
};

export const mockRiskAnalysisWithoutTenantKind = () => {
  const mockedRA = getMockValidRiskAnalysis(tenantKind.PA);
  delete mockedRA.riskAnalysisForm.tenantKind;
  return mockedRA;
};

export const mockRiskAnalysisFormWithoutTenantKind = () => {
  const mockedRAForm = getMockValidRiskAnalysisForm(tenantKind.PA);
  delete mockedRAForm.tenantKind;
  return mockedRAForm;
};
