/* eslint-disable max-params */
import { purposeTemplateApi } from "pagopa-interop-api-clients";
import {
  getInteropHeaders,
  Logger,
  RefreshableInteropToken,
} from "pagopa-interop-commons";
import {
  CorrelationId,
  PurposeTemplateId,
  RiskAnalysisTemplateDocument,
  generateId,
} from "pagopa-interop-models";
import { getInteropBeClients } from "../../clients/clientProvider.js";

export const addPurposeTemplateSignedDocument = async (
  purposeTemplateId: PurposeTemplateId,
  document: RiskAnalysisTemplateDocument,
  refreshableToken: RefreshableInteropToken,
  correlationId: CorrelationId,
  logger: Logger
): Promise<void> => {
  logger.info(
    `addPurposeTemplateSignedDocument: Risk Analysis Template Document ${JSON.stringify(
      document
    )}`
  );

  const token = (await refreshableToken.get()).serialized;
  const signedDocument: purposeTemplateApi.RiskAnalysisTemplateSignedDocument =
    {
      ...document,
      id: generateId(),
      createdAt: new Date(document.createdAt).toISOString(),
      signedAt: new Date().toISOString(),
    };

  const { purposeTemplateProcessClient } = getInteropBeClients();

  await purposeTemplateProcessClient.internalAddRiskAnalysisTemplateSignedDocumentMetadata(
    signedDocument,
    {
      params: { purposeTemplateId },
      headers: getInteropHeaders({
        token,
        correlationId,
      }),
    }
  );
};
