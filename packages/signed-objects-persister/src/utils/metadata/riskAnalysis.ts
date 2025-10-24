/* eslint-disable no-console */
// import { purposeApi } from "pagopa-interop-api-clients";
import { PurposeId, PurposeVersionDocument } from "pagopa-interop-models";
import { BRAND } from "zod";

// export const addPurposeRiskAnalysisSignedDocument = async (
//   purposeId: PurposeId,
//   versionId: string,
//   document: PurposeVersionDocument
// ): Promise<unknown> =>
//   purposeApi.purposeApi.api.postRiskAnalysisSignedDocument({
//     purposeId,
//     versionId,
//     body: document,
//   });

type PurposeRiskAnalysisSignedDocumentResponse = {
  purposeId: PurposeId;
  versionId: string & BRAND<"PurposeVersionDocumentId">;
  document: PurposeVersionDocument;
  event: "RiskAnalysisSignedDocumentAdded";
  timestamp: number;
};

export const addPurposeRiskAnalysisSignedDocument = async (
  purposeId: PurposeId,
  versionId: string & BRAND<"PurposeVersionDocumentId">,
  document: PurposeVersionDocument
): Promise<PurposeRiskAnalysisSignedDocumentResponse> => {
  console.log(
    `Mock: aggiungo documento firmato di risk analysis alla finalità ${purposeId}, versione ${versionId}`
  );
  console.log("Documento:", document);

  await new Promise((resolve) => setTimeout(resolve, 200));

  return {
    purposeId,
    versionId,
    document,
    event: "RiskAnalysisSignedDocumentAdded",
    timestamp: new Date().getMilliseconds(),
  };
};
