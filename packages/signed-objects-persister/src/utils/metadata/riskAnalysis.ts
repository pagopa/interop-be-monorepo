/* eslint-disable no-console */
import { purposeApi } from "pagopa-interop-api-clients";
import {
  getInteropHeaders,
  RefreshableInteropToken,
} from "pagopa-interop-commons";
import {
  CorrelationId,
  PurposeId,
  PurposeVersionDocument,
  PurposeVersionDocumentId,
} from "pagopa-interop-models";

export const addPurposeRiskAnalysisSignedDocument = async (
  purposeId: PurposeId,
  versionId: PurposeVersionDocumentId,
  document: PurposeVersionDocument,
  refreshableToken: RefreshableInteropToken,
  correlationId: CorrelationId
): Promise<void> => {
  const token = (await refreshableToken.get()).serialized;
  const documentSigned: purposeApi.PurposeVersionSignedDocument = {
    ...document,
    createdAt: document.createdAt.toISOString(),
    signedAt: new Date().toISOString(),
  };
  await purposeApi.purposeApi.addSignedRiskAnalysisDocumentMetadata(
    documentSigned,
    {
      params: { purposeId, versionId },
      headers: getInteropHeaders({
        token,
        correlationId,
      }),
    }
  );
};
