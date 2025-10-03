import {
  ReadEvent,
  readLastEventByStreamId,
  setupTestContainersVitest,
  sortPurposeTemplate,
  StoredEvent,
  writeInEventstore,
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
  EService,
  Tenant,
  toPurposeTemplateV2,
} from "pagopa-interop-models";
import {
  upsertEService,
  upsertPurposeTemplate,
  upsertPurposeTemplateEServiceDescriptor,
  upsertTenant,
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

export const writePurposeTemplateInEventstore = async (
  purposeTemplate: PurposeTemplate
): Promise<void> => {
  const purposeTemplateEvent: PurposeTemplateEvent = {
    type: "PurposeTemplateAdded",
    event_version: 2,
    data: { purposeTemplate: toPurposeTemplateV2(purposeTemplate) },
  };
  const eventToWrite: StoredEvent<PurposeTemplateEvent> = {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    stream_id: purposeTemplateEvent.data.purposeTemplate!.id,
    version: 0,
    event: purposeTemplateEvent,
  };
  await writeInEventstore(eventToWrite, "purpose_template", postgresDB);
};

export const addOnePurposeTemplate = async (
  purposeTemplate: PurposeTemplate
): Promise<void> => {
  await writePurposeTemplateInEventstore(purposeTemplate);
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

export const addOneEService = async (eservice: EService): Promise<void> => {
  await upsertEService(readModelDB, eservice, 0);
};

export const addOneTenant = async (tenant: Tenant): Promise<void> => {
  await upsertTenant(readModelDB, tenant, 0);
};
