/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { riskAnalysisFormToRiskAnalysisFormToValidate } from "pagopa-interop-commons";
import {
  Purpose,
  RiskAnalysis,
  RiskAnalysisForm,
  generateId,
  tenantKind,
  unsafeBrandId,
} from "pagopa-interop-models";
import { getMockValidRiskAnalysisForm } from "pagopa-interop-commons-test";
import { purposeApi } from "pagopa-interop-api-clients";
import { PurposeRiskAnalysisFormV2 } from "../../models/dist/gen/v2/purpose/riskAnalysis.js";

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

export const getMockPurposeSeed = (
  eserviceId: string = generateId(),
  consumerId: string = generateId(),
  riskAnalysisForm: purposeApi.RiskAnalysisFormSeed = buildRiskAnalysisFormSeed(
    getMockValidRiskAnalysisForm(tenantKind.PA)
  )
): purposeApi.PurposeSeed => ({
  eserviceId,
  consumerId,
  title: "Mock title",
  dailyCalls: 10,
  description: "Mock description",
  isFreeOfCharge: true,
  freeOfChargeReason: "reason",
  riskAnalysisForm,
});

export const getMockReversePurposeSeed = (
  eServiceId: string = generateId(),
  consumerId: string = generateId(),
  riskAnalysisId: string = generateId()
): purposeApi.EServicePurposeSeed => ({
  eServiceId,
  consumerId,
  riskAnalysisId,
  title: "test purpose title",
  description: "test purpose description",
  isFreeOfCharge: true,
  freeOfChargeReason: "test",
  dailyCalls: 1,
});
