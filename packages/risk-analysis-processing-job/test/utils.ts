import {
  getMockValidRiskAnalysis,
  setupTestContainersVitest,
} from "pagopa-interop-commons-test";
import { EService, Purpose, tenantKind } from "pagopa-interop-models";
import { afterEach, inject } from "vitest";
import {
  upsertEService,
  upsertPurpose,
} from "pagopa-interop-readmodel/testUtils";
import { readModelServiceBuilderSQL } from "../src/services/readModelServiceSQL.js";

const config = inject("readModelSQLConfig");

export const { cleanup, readModelDB } = await setupTestContainersVitest(
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  inject("readModelSQLConfig")
);

afterEach(cleanup);

if (!config) {
  throw new Error("Config is not defined");
}

export const readModelService = readModelServiceBuilderSQL(readModelDB);

export const addOneEService = async (eservice: EService): Promise<void> => {
  await upsertEService(readModelDB, eservice, 0);
};

export const addOnePurpose = async (purpose: Purpose): Promise<void> => {
  await upsertPurpose(readModelDB, purpose, 0);
};

export const mockRiskAnalysisWithoutTenantKind = () => {
  const mockedRA = getMockValidRiskAnalysis(tenantKind.PA);
  delete mockedRA.riskAnalysisForm.tenantKind;
  return mockedRA;
};
