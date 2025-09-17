import {
  ReadEvent,
  readLastEventByStreamId,
  setupTestContainersVitest,
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
  PurposeTemplate,
  PurposeTemplateEvent,
  PurposeTemplateId,
  RiskAnalysisTemplateAnswerAnnotationDocumentId,
  Tenant,
  toPurposeTemplateV2,
} from "pagopa-interop-models";
import {
  upsertPurposeTemplate,
  upsertTenant,
} from "pagopa-interop-readmodel/testUtils";
import { genericLogger } from "pagopa-interop-commons";
import { readModelServiceBuilderSQL } from "../src/services/readModelServiceSQL.js";
import { purposeTemplateServiceBuilder } from "../src/services/purposeTemplateService.js";
import { config } from "../src/config/config.js";

export const { cleanup, postgresDB, readModelDB, fileManager } =
  await setupTestContainersVitest(
    undefined,
    inject("eventStoreConfig"),
    inject("fileManagerConfig"),
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
  readModelService,
  fileManager
);

export const writePurposeTemplateInEventstore = async (
  purposeTemplate: PurposeTemplate
): Promise<void> => {
  const purposeTemplateEvent: PurposeTemplateEvent = {
    type: "PurposeTemplateAdded",
    event_version: 2,
    data: {
      purposeTemplate: toPurposeTemplateV2(purposeTemplate),
    },
  };

  const eventToWrite: StoredEvent<PurposeTemplateEvent> = {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    stream_id: purposeTemplateEvent.data.purposeTemplate!.id,
    version: 0,
    event: purposeTemplateEvent,
  };
  await writeInEventstore(eventToWrite, "purpose_template", postgresDB);
};

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
  await writePurposeTemplateInEventstore(purposeTemplate);
  await upsertPurposeTemplate(readModelDB, purposeTemplate, 0);
};
export const addOneTenant = async (tenant: Tenant): Promise<void> => {
  await upsertTenant(readModelDB, tenant, 0);
};

export async function uploadDocument(
  purposeTemplateId: PurposeTemplateId,
  documentId: RiskAnalysisTemplateAnswerAnnotationDocumentId,
  name: string
): Promise<void> {
  const documentDestinationPath = `${config.purposeTemplateAnnotationsPath}/${purposeTemplateId}`;
  await fileManager.storeBytes(
    {
      bucket: config.s3Bucket,
      path: documentDestinationPath,
      resourceId: documentId,
      name,
      content: Buffer.from("large-document-file"),
    },
    genericLogger
  );

  expect(
    await fileManager.listFiles(config.s3Bucket, genericLogger)
  ).toContainEqual(`${documentDestinationPath}/${documentId}/${name}`);
}
