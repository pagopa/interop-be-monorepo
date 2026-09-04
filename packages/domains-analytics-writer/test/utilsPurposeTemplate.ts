import {
  getMockPurposeTemplate,
  getMockCompleteRiskAnalysisFormTemplate,
} from "pagopa-interop-commons-test";
import { PurposeTemplate } from "pagopa-interop-models";

export const getCompleteMockPurposeTemplate = (): PurposeTemplate => ({
  ...getMockPurposeTemplate(),
  updatedAt: new Date(),
  purposeRiskAnalysisForm: getMockCompleteRiskAnalysisFormTemplate(),
  purposeFreeOfChargeReason: "Free of charge reason",
  purposeDailyCalls: 100,
});
