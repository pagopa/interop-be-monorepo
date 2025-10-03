import {
  ReadEvent,
  readLastEventByStreamId,
  setupTestContainersVitest,
  sortPurposeTemplate,
} from "pagopa-interop-commons-test";
import { afterEach, expect, inject } from "vitest";
import {
  catalogReadModelServiceBuilder,
  purposeTemplateReadModelServiceBuilder,
  tenantReadModelServiceBuilder,
} from "pagopa-interop-readmodel";
import {
  EServiceDescriptorPurposeTemplate,
  ListResult,
  PurposeTemplate,
  PurposeTemplateEvent,
  PurposeTemplateId,
} from "pagopa-interop-models";
import {
  upsertPurposeTemplate,
  upsertPurposeTemplateEServiceDescriptor,
} from "pagopa-interop-readmodel/testUtils";
import { readModelServiceBuilderSQL } from "../src/services/readModelServiceSQL.js";
import { purposeTemplateServiceBuilder } from "../src/services/purposeTemplateService.js";

export const { cleanup, postgresDB, readModelDB } =
  await setupTestContainersVitest(
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
  readModelDB,
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

export function expectSinglePageListResult(
  actual: ListResult<PurposeTemplate>,
  expected: PurposeTemplate[]
): void {
  expect({
    totalCount: actual.totalCount,
    results: actual.results.map(sortPurposeTemplate),
  }).toEqual({
    totalCount: expected.length,
    results: expected.map(sortPurposeTemplate),
  });
  expect(actual.results).toHaveLength(expected.length);
}

export const addOnePurposeTemplate = async (
  purposeTemplate: PurposeTemplate
): Promise<void> => {
  await upsertPurposeTemplate(readModelDB, purposeTemplate, 0);
};

export const addOnePurposeTemplateEServiceDescriptor = async (
  purposeTemplateEServiceDescriptor: EServiceDescriptorPurposeTemplate
): Promise<void> => {
  await upsertPurposeTemplateEServiceDescriptor(
    readModelDB,
    purposeTemplateEServiceDescriptor,
    0
  );
};
