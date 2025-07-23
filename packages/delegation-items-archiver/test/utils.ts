/* eslint-disable functional/no-let */
import {
  setupTestContainersVitest,
  writeInReadmodel,
} from "pagopa-interop-commons-test";
import {
  Agreement,
  Purpose,
  toReadModelAgreement,
  toReadModelPurpose,
} from "pagopa-interop-models";
import { afterEach, inject } from "vitest";
import {
  agreementReadModelServiceBuilder,
  purposeReadModelServiceBuilder,
} from "pagopa-interop-readmodel";
import { upsertAgreement } from "pagopa-interop-readmodel/testUtils";
import { readModelServiceBuilder } from "../src/readModelService.js";
import { config } from "../src/config/config.js";
import { readModelServiceBuilderSQL } from "../src/readModelServiceSQL.js";

export const { cleanup, readModelRepository, readModelDB } =
  await setupTestContainersVitest(
    inject("readModelConfig"),
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    inject("readModelSQLConfig")
  );
afterEach(cleanup);

export const { purposes, agreements } = readModelRepository;

const agreementReadModelServiceSQL =
  agreementReadModelServiceBuilder(readModelDB);
const purposeReadModelServiceSQL = purposeReadModelServiceBuilder(readModelDB);

const oldReadModelService = readModelServiceBuilder(readModelRepository);

const readModelServiceSQL = readModelServiceBuilderSQL({
  readModelDB,
  agreementReadModelServiceSQL,
  purposeReadModelServiceSQL,
});
export const readModelService =
  config.featureFlagSQL &&
  config.readModelSQLDbHost &&
  config.readModelSQLDbPort
    ? readModelServiceSQL
    : oldReadModelService;

export const addOnePurpose = async (purpose: Purpose): Promise<void> => {
  await writeInReadmodel(toReadModelPurpose(purpose), purposes);
  await purposeReadModelServiceSQL.upsertPurpose(purpose, 1);
};

export const addOneAgreement = async (agreement: Agreement): Promise<void> => {
  await writeInReadmodel(toReadModelAgreement(agreement), agreements);
  await upsertAgreement(readModelDB, agreement, 1);
};
