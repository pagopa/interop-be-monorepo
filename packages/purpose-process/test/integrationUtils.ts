/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* @typescript-eslint/no-explicit-any */
import {
  initPDFGenerator,
  launchPuppeteerBrowser,
} from "pagopa-interop-commons";
import {
  ReadEvent,
  StoredEvent,
  readLastEventByStreamId,
  setupTestContainersVitest,
  sortPurpose,
  writeInEventstore,
} from "pagopa-interop-commons-test";
import {
  EService,
  Purpose,
  PurposeEvent,
  toPurposeV2,
  Tenant,
  Agreement,
  Delegation,
  PurposeId,
  ListResult,
  PurposeTemplate,
  EServiceDescriptorPurposeTemplate,
  PurposeTemplateEvent,
  toPurposeTemplateV2,
  PurposeRiskAnalysisForm,
  PurposeRiskAnalysisFormV2,
  RiskAnalysisSingleAnswer,
  RiskAnalysisMultiAnswer,
  RiskAnalysisSingleAnswerV2,
  RiskAnalysisMultiAnswerV2,
} from "pagopa-interop-models";
import { afterAll, afterEach, expect, inject, vi } from "vitest";
import puppeteer, { Browser } from "puppeteer";
import {
  agreementReadModelServiceBuilder,
  catalogReadModelServiceBuilder,
  delegationReadModelServiceBuilder,
  purposeReadModelServiceBuilder,
  purposeTemplateReadModelServiceBuilder,
  tenantReadModelServiceBuilder,
} from "pagopa-interop-readmodel";
import {
  upsertAgreement,
  upsertDelegation,
  upsertEService,
  upsertPurpose,
  upsertPurposeTemplate,
  upsertPurposeTemplateEServiceDescriptor,
  upsertTenant,
} from "pagopa-interop-readmodel/testUtils";
import {
  UpdatePurposeReturn,
  purposeServiceBuilder,
} from "../src/services/purposeService.js";
import { readModelServiceBuilderSQL } from "../src/services/readModelServiceSQL.js";

export const { cleanup, postgresDB, fileManager, readModelDB } =
  await setupTestContainersVitest(
    inject("eventStoreConfig"),
    inject("fileManagerConfig"),
    undefined,
    undefined,
    undefined,
    inject("readModelSQLConfig")
  );

afterEach(cleanup);

export const purposeReadModelServiceSQL =
  purposeReadModelServiceBuilder(readModelDB);
export const catalogReadModelServiceSQL =
  catalogReadModelServiceBuilder(readModelDB);
export const tenantReadModelServiceSQL =
  tenantReadModelServiceBuilder(readModelDB);
export const agreementReadModelServiceSQL =
  agreementReadModelServiceBuilder(readModelDB);
export const delegationReadModelServiceSQL =
  delegationReadModelServiceBuilder(readModelDB);
export const purposeTemplateReadModelServiceSQL =
  purposeTemplateReadModelServiceBuilder(readModelDB);

export const readModelService = readModelServiceBuilderSQL({
  readModelDB,
  purposeReadModelServiceSQL,
  catalogReadModelServiceSQL,
  tenantReadModelServiceSQL,
  agreementReadModelServiceSQL,
  delegationReadModelServiceSQL,
  purposeTemplateReadModelServiceSQL,
});

const testBrowserInstance: Browser = await launchPuppeteerBrowser({
  pipe: true,
});
const closeTestBrowserInstance = async (): Promise<void> =>
  await testBrowserInstance.close();

afterAll(closeTestBrowserInstance);

vi.spyOn(puppeteer, "launch").mockImplementation(
  async () => testBrowserInstance
);
export const pdfGenerator = await initPDFGenerator();

export const purposeService = purposeServiceBuilder(
  postgresDB,
  readModelService,
  fileManager,
  pdfGenerator
);

export const addOnePurpose = async (purpose: Purpose): Promise<void> => {
  await writePurposeInEventstore(purpose);
  await upsertPurpose(readModelDB, purpose, 0);
};

export const addOneEService = async (eservice: EService): Promise<void> => {
  await upsertEService(readModelDB, eservice, 0);
};

export const addOneTenant = async (tenant: Tenant): Promise<void> => {
  await upsertTenant(readModelDB, tenant, 0);
};

export const addOneAgreement = async (agreement: Agreement): Promise<void> => {
  await upsertAgreement(readModelDB, agreement, 0);
};

export const addOneDelegation = async (
  delegation: Delegation
): Promise<void> => {
  await upsertDelegation(readModelDB, delegation, 0);
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

export const writePurposeInEventstore = async (
  purpose: Purpose
): Promise<void> => {
  const purposeEvent: PurposeEvent = {
    type: "PurposeAdded",
    event_version: 2,
    data: { purpose: toPurposeV2(purpose) },
  };
  const eventToWrite: StoredEvent<PurposeEvent> = {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    stream_id: purposeEvent.data.purpose!.id,
    version: 0,
    event: purposeEvent,
  };

  await writeInEventstore(eventToWrite, "purpose", postgresDB);
};

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

export const readLastPurposeEvent = async (
  purposeId: PurposeId
): Promise<ReadEvent<PurposeEvent>> =>
  await readLastEventByStreamId(purposeId, "purpose", postgresDB);

export function expectSinglePageListResult(
  actual: ListResult<Purpose>,
  expected: Purpose[]
): void {
  expect({
    totalCount: actual.totalCount,
    results: actual.results.map(sortPurpose),
  }).toEqual({
    totalCount: expected.length,
    results: expected.map(sortPurpose),
  });
  expect(actual.results).toHaveLength(expected.length);
}

export const sortUpdatePurposeReturn = (
  updatePurposeReturn: UpdatePurposeReturn
): UpdatePurposeReturn => ({
  ...updatePurposeReturn,
  data: {
    ...updatePurposeReturn.data,
    purpose: sortPurpose(updatePurposeReturn.data.purpose),
  },
});

export function expectUniqueAswerInRiskAnalysisForm(
  riskAnalysisForm: PurposeRiskAnalysisForm,
  answerKey: string
): void {
  assertUniqueAnswerOccurrence(
    riskAnalysisForm.singleAnswers,
    riskAnalysisForm.multiAnswers,
    answerKey
  );
}

export function expectUniqueAswerInRiskAnalysisFormV2(
  riskAnalysisFormV2: PurposeRiskAnalysisFormV2,
  answerKey: string
): void {
  assertUniqueAnswerOccurrence(
    riskAnalysisFormV2.singleAnswers,
    riskAnalysisFormV2.multiAnswers,
    answerKey
  );
}

function assertUniqueAnswerOccurrence(
  singleAnswers: RiskAnalysisSingleAnswer[] | RiskAnalysisSingleAnswerV2[],
  multiAnswers: RiskAnalysisMultiAnswer[] | RiskAnalysisMultiAnswerV2[],
  answerKey: string
): void {
  const expectedOneOccurrenceInSingleAnswers = singleAnswers.filter(
    (a) => a.key === answerKey
  );

  const expectedOneOccurrenceInMultiAnswers = multiAnswers.filter(
    (a) => a.key === answerKey
  );

  if (expectedOneOccurrenceInSingleAnswers.length) {
    expect(expectedOneOccurrenceInSingleAnswers.length).toBe(1);
  }

  if (expectedOneOccurrenceInMultiAnswers.length) {
    expect(expectedOneOccurrenceInMultiAnswers.length).toBe(1);
  }

  expect(
    expectedOneOccurrenceInSingleAnswers.length +
      expectedOneOccurrenceInMultiAnswers.length
  ).toBe(1);
}
