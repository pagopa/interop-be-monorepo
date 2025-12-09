/* eslint-disable max-params */
import { purposeApi } from "pagopa-interop-api-clients";
import {
  getInteropHeaders,
  Logger,
  RefreshableInteropToken,
} from "pagopa-interop-commons";
import {
  CorrelationId,
  generateId,
  PurposeId,
  PurposeVersionDocument,
  PurposeVersionDocumentId,
} from "pagopa-interop-models";
import { getInteropBeClients } from "../../clients/clientProvider.js";

export const addPurposeRiskAnalysisSignedDocument = async (
  purposeId: PurposeId,
  versionId: PurposeVersionDocumentId,
  document: PurposeVersionDocument,
  refreshableToken: RefreshableInteropToken,
  correlationId: CorrelationId,
  logger: Logger
): Promise<void> => {
  logger.info(
    `addPurposeRiskAnalysisSignedDocument: Risk Analysis Document ${JSON.stringify(
      document
    )}`
  );
  const token = (await refreshableToken.get()).serialized;
  const documentSigned: purposeApi.PurposeVersionSignedDocument = {
    ...document,
    id: generateId(),
    createdAt: new Date(document.createdAt).toISOString(),
    signedAt: new Date().toISOString(),
  };

  const { purposeProcessClient } = getInteropBeClients();

  await purposeProcessClient.addSignedRiskAnalysisDocumentMetadata(
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
