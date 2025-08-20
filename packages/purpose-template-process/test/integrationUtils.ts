import {
  ReadEvent,
  readLastEventByStreamId,
  setupTestContainersVitest,
  writeInReadmodel,
} from "pagopa-interop-commons-test";
import { afterEach, inject } from "vitest";
import {
  catalogReadModelServiceBuilder,
  purposeTemplateReadModelServiceBuilder,
  tenantReadModelServiceBuilder,
} from "pagopa-interop-readmodel";
import {
  PurposeTemplate,
  PurposeTemplateEvent,
  PurposeTemplateId,
} from "pagopa-interop-models";
import { upsertPurposeTemplate } from "pagopa-interop-readmodel/testUtils";
import { readModelServiceBuilderSQL } from "../src/services/readModelServiceSQL.js";
import { purposeTemplateServiceBuilder } from "../src/services/purposeTemplateService.js";

export const { cleanup, postgresDB, readModelDB } =
  await setupTestContainersVitest(
    undefined,
    inject("eventStoreConfig"),
    undefined,
    undefined,
    undefined,
    undefined,
    inject("readModelSQLConfig")
  );

afterEach(cleanup);

export const catalogReadModelServiceSQL =
  catalogReadModelServiceBuilder(readModelDB);

export const tenantReadModelServiceSQL =
  tenantReadModelServiceBuilder(readModelDB);

export const purposeTemplateReadModelServiceSQL =
  purposeTemplateReadModelServiceBuilder(readModelDB);

export const readModelService = readModelServiceBuilderSQL({
  catalogReadModelServiceSQL,
  tenantReadModelServiceSQL,
  purposeTemplateReadModelServiceSQL,
});

export const purposeTemplateService = purposeTemplateServiceBuilder(
  postgresDB,
  readModelService
);

export const readLastPurposeTemplateEvent = async (
  purposeTemplateId: PurposeTemplateId
): Promise<ReadEvent<PurposeTemplateEvent>> =>
  await readLastEventByStreamId(
    purposeTemplateId,
    "purpose_template",
    postgresDB
  );

export const addOnePurposeTemplate = async (
  purposeTemplate: PurposeTemplate
): Promise<void> => {
  await upsertPurposeTemplate(readModelDB, purposeTemplate, 0);
};
