/* eslint-disable @typescript-eslint/no-non-null-assertion */
import {
  initPDFGenerator,
  launchPuppeteerBrowser,
  riskAnalysisFormToRiskAnalysisFormToValidate,
} from "pagopa-interop-commons";
import {
  ReadEvent,
  StoredEvent,
  setupTestContainersVitest,
  writeInEventstore,
  writeInReadmodel,
  readLastEventByStreamId,
} from "pagopa-interop-commons-test";
import {
  EService,
  Purpose,
  PurposeEvent,
  RiskAnalysis,
  RiskAnalysisForm,
  generateId,
  technology,
  toPurposeV2,
  unsafeBrandId,
  toReadModelPurpose,
  PurposeId,
} from "pagopa-interop-models";
import { purposeApi } from "pagopa-interop-api-clients";
import { afterAll, afterEach, inject, vi } from "vitest";
import puppeteer, { Browser } from "puppeteer";
import { PurposeRiskAnalysisFormV2 } from "../../models/dist/gen/v2/purpose/riskAnalysis.js";
import { readModelServiceBuilder } from "../src/services/readModelService.js";
import { purposeServiceBuilder } from "../src/services/purposeService.js";

export const { cleanup, readModelRepository, postgresDB, fileManager } =
  await setupTestContainersVitest(
    inject("readModelConfig"),
    inject("eventStoreConfig"),
    inject("fileManagerConfig")
  );

afterEach(cleanup);

export const agreements = readModelRepository.agreements;
export const eservices = readModelRepository.eservices;
export const tenants = readModelRepository.tenants;
export const attributes = readModelRepository.attributes;
export const purposes = readModelRepository.purposes;

export const readModelService = readModelServiceBuilder(readModelRepository);

const testBrowserInstance: Browser = await launchPuppeteerBrowser({
  pipe: true,
});
const closeTestBrowserInstance = async (): Promise<void> =>
  await testBrowserInstance.close();

afterAll(closeTestBrowserInstance);

vi.spyOn(puppeteer, "launch").mockImplementation(
  async () => testBrowserInstance
);
const pdfGenerator = await initPDFGenerator();

export const purposeService = purposeServiceBuilder(
  postgresDB,
  readModelService,
  fileManager,
  pdfGenerator
);

export const addOnePurpose = async (purpose: Purpose): Promise<void> => {
  await writePurposeInEventstore(purpose);
  await writeInReadmodel(toReadModelPurpose(purpose), purposes);
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

export const getMockEService = (): EService => ({
  id: generateId(),
  name: "eService name",
  description: "eService description",
  createdAt: new Date(),
  producerId: generateId(),
  technology: technology.rest,
  descriptors: [],
  attributes: undefined,
  riskAnalysis: [],
  mode: "Deliver",
});

export const buildRiskAnalysisSeed = (
  riskAnalysis: RiskAnalysis
): purposeApi.RiskAnalysisFormSeed =>
  riskAnalysisFormToRiskAnalysisFormToValidate(riskAnalysis.riskAnalysisForm);

export const buildRiskAnalysisFormSeed = (
  riskAnalysisForm: RiskAnalysisForm
): purposeApi.RiskAnalysisFormSeed =>
  riskAnalysisFormToRiskAnalysisFormToValidate(riskAnalysisForm);

export const createUpdatedPurpose = (
  mockPurpose: Purpose,
  purposeUpdateContent:
    | purposeApi.PurposeUpdateContent
    | purposeApi.ReversePurposeUpdateContent,
  mockValidRiskAnalysis: RiskAnalysis,
  writtenRiskAnalysisForm: PurposeRiskAnalysisFormV2
): Purpose => ({
  ...mockPurpose,
  title: purposeUpdateContent.title,
  description: purposeUpdateContent.description,
  isFreeOfCharge: purposeUpdateContent.isFreeOfCharge,
  freeOfChargeReason: purposeUpdateContent.freeOfChargeReason,
  versions: [
    {
      ...mockPurpose.versions[0],
      dailyCalls: purposeUpdateContent.dailyCalls,
      updatedAt: new Date(),
    },
  ],
  updatedAt: new Date(),
  riskAnalysisForm: {
    ...mockValidRiskAnalysis.riskAnalysisForm,
    id: unsafeBrandId(writtenRiskAnalysisForm.id),
    singleAnswers: mockValidRiskAnalysis.riskAnalysisForm.singleAnswers.map(
      (singleAnswer) => ({
        ...singleAnswer,
        id: unsafeBrandId(
          writtenRiskAnalysisForm.singleAnswers.find(
            (sa) => sa.key === singleAnswer.key
          )!.id
        ),
      })
    ),
    multiAnswers: mockValidRiskAnalysis.riskAnalysisForm.multiAnswers.map(
      (multiAnswer) => ({
        ...multiAnswer,
        id: unsafeBrandId(
          writtenRiskAnalysisForm.multiAnswers.find(
            (ma) => ma.key === multiAnswer.key
          )!.id
        ),
      })
    ),
  },
});

export const readLastPurposeEvent = async (
  purposeId: PurposeId
): Promise<ReadEvent<PurposeEvent>> =>
  await readLastEventByStreamId(purposeId, "purpose", postgresDB);
