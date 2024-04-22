/* eslint-disable @typescript-eslint/no-non-null-assertion */
import {
  PurposeCollection,
  riskAnalysisFormToRiskAnalysisFormToValidate,
} from "pagopa-interop-commons";
import {
  StoredEvent,
  writeInEventstore,
  writeInReadmodel,
} from "pagopa-interop-commons-test";
import {
  DraftPurposeUpdatedV2,
  EService,
  Purpose,
  PurposeEvent,
  RiskAnalysis,
  generateId,
  technology,
  toPurposeV2,
  unsafeBrandId,
} from "pagopa-interop-models";
import { IDatabase } from "pg-promise";
import {
  ApiPurposeUpdateContent,
  ApiReversePurposeUpdateContent,
  ApiRiskAnalysisFormSeed,
} from "../src/model/domain/models.js";

export const addOnePurpose = async (
  purpose: Purpose,
  postgresDB: IDatabase<unknown>,
  purposes: PurposeCollection
): Promise<void> => {
  await writePurposeInEventstore(purpose, postgresDB);
  await writeInReadmodel(purpose, purposes);
};

export const writePurposeInEventstore = async (
  purpose: Purpose,
  postgresDB: IDatabase<unknown>
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
): ApiRiskAnalysisFormSeed =>
  riskAnalysisFormToRiskAnalysisFormToValidate(riskAnalysis.riskAnalysisForm);

export const createUpdatedPurpose = (
  mockPurpose: Purpose,
  purposeUpdateContent:
    | ApiPurposeUpdateContent
    | ApiReversePurposeUpdateContent,
  mockValidRiskAnalysis: RiskAnalysis,
  writtenPayload: DraftPurposeUpdatedV2
): Purpose => ({
  ...mockPurpose,
  title: purposeUpdateContent.title,
  description: purposeUpdateContent.description,
  isFreeOfCharge: purposeUpdateContent.isFreeOfCharge,
  freeOfChargeReason: purposeUpdateContent.freeOfChargeReason,
  updatedAt: new Date(Number(writtenPayload.purpose?.updatedAt)),
  riskAnalysisForm: {
    ...mockValidRiskAnalysis.riskAnalysisForm,
    id: unsafeBrandId(writtenPayload.purpose!.riskAnalysisForm!.id),
    singleAnswers: mockValidRiskAnalysis.riskAnalysisForm.singleAnswers.map(
      (singleAnswer) => ({
        ...singleAnswer,
        id: unsafeBrandId(
          writtenPayload.purpose!.riskAnalysisForm!.singleAnswers.find(
            (sa) => sa.key === singleAnswer.key
          )!.id
        ),
      })
    ),
    multiAnswers: mockValidRiskAnalysis.riskAnalysisForm.multiAnswers.map(
      (multiAnswer) => ({
        ...multiAnswer,
        id: unsafeBrandId(
          writtenPayload.purpose!.riskAnalysisForm!.multiAnswers.find(
            (ma) => ma.key === multiAnswer.key
          )!.id
        ),
      })
    ),
  },
});
