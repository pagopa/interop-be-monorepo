import { purposeTemplateApi } from "pagopa-interop-api-clients";
import { genericLogger } from "pagopa-interop-commons";
import {
  ReadEvent,
  readLastEventByStreamId,
  setupTestContainersVitest,
  StoredEvent,
  writeInEventstore,
} from "pagopa-interop-commons-test";
import {
  PurposeTemplate,
  PurposeTemplateEvent,
  PurposeTemplateId,
  RiskAnalysisTemplateAnswerAnnotation,
  RiskAnalysisTemplateAnswerAnnotationDocumentId,
  Tenant,
  toPurposeTemplateV2,
} from "pagopa-interop-models";
import {
  catalogReadModelServiceBuilder,
  purposeTemplateReadModelServiceBuilder,
  tenantReadModelServiceBuilder,
} from "pagopa-interop-readmodel";
import {
  upsertPurposeTemplate,
  upsertTenant,
} from "pagopa-interop-readmodel/testUtils";
import { afterEach, expect, inject } from "vitest";
import { config } from "../src/config/config.js";
import { purposeTemplateServiceBuilder } from "../src/services/purposeTemplateService.js";
import { readModelServiceBuilderSQL } from "../src/services/readModelServiceSQL.js";

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
  const documentDestinationPath = `${config.purposeTemplateDocumentsPath}/${purposeTemplateId}`;
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

/**
 * Builder class for creating and manipulating PurposeTemplateSeed API objects.
 * This utility helps with constructing and modifying PurposeTemplateSeed objects in a fluent style,
 * especially useful for testing scenarios where specific modifications to template seeds are needed, 
 * its usages make tests more readable and maintainable.
 * The builder provides methods to:
 * - Remove specific answers from the purpose risk analysis form
 * - Add annotations to specific answers
 * - Build the final PurposeTemplateSeed object
 */
export class PurposeTemplateSeedApiBuilder {
  private seed: purposeTemplateApi.PurposeTemplateSeed;

  constructor(seed: purposeTemplateApi.PurposeTemplateSeed) {
    this.seed = { ...seed };
  }

  public removeAnswer(
    answerKeyToRemove: string | undefined
  ): PurposeTemplateSeedApiBuilder {
    if (!answerKeyToRemove) {
      return this;
    }

    const answers = this.seed.purposeRiskAnalysisForm?.answers || {};
    const filteredEntries = Object.entries(answers).filter(
      ([answerKey]) => answerKey !== answerKeyToRemove
    );

    // eslint-disable-next-line functional/immutable-data
    this.seed = {
      ...this.seed,
      purposeRiskAnalysisForm: {
        ...this.seed.purposeRiskAnalysisForm,
        version: String(this.seed.purposeRiskAnalysisForm?.version),
        answers: Object.fromEntries(filteredEntries),
      },
    };

    return this;
  }

  public addAnnotationToAnswer(
    answerKey: string,
    annotation: RiskAnalysisTemplateAnswerAnnotation // accept domain model
  ): PurposeTemplateSeedApiBuilder {
    const answers = this.seed.purposeRiskAnalysisForm?.answers || {};
    const updatedEntries = Object.entries(answers).map(([key, answer]) =>
      key === answerKey ? [key, { ...answer, annotation }] : [key, answer]
    );

    // eslint-disable-next-line functional/immutable-data
    this.seed = {
      ...this.seed,
      purposeRiskAnalysisForm: {
        ...this.seed.purposeRiskAnalysisForm,
        version: String(this.seed.purposeRiskAnalysisForm?.version),
        answers: Object.fromEntries(updatedEntries),
      },
    };

    return this;
  }

  public build(): purposeTemplateApi.PurposeTemplateSeed {
    return this.seed;
  }
}
