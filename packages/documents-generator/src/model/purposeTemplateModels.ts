import { PurposeTemplateId } from "pagopa-interop-models";

export type RiskAnalysisTemplateDocumentPDFPayload = {
  purposeTemplateId: PurposeTemplateId;
  creatorName: string;
  targetDescription: string;
  handlesPersonalData: string;
  purposeIsFreeOfCharge: string;
  purposeFreeOfChargeReason: string;
  answers: string;
  date: string;
};
