import {
  WithLogger,
  systemRole,
  genericLogger,
  riskAnalysisFormToRiskAnalysisFormToValidate,
  M2MAdminAuthData,
} from "pagopa-interop-commons";
import {
  CorrelationId,
  EServiceTemplateRiskAnalysis,
  RiskAnalysis,
  TenantId,
  generateId,
} from "pagopa-interop-models";
import { generateMock } from "@anatine/zod-mock";
import { z } from "zod";
import { catalogApi, m2mGatewayApiV3 } from "pagopa-interop-api-clients";
import { M2MGatewayAppContext } from "../src/utils/context.js";
import { DownloadedDocument } from "../src/utils/fileDownload.js";

export const m2mTestToken = generateMock(z.string().base64());

export const getMockM2MAdminAppContext = ({
  organizationId,
  serviceName,
}: {
  organizationId?: TenantId;
  serviceName?: string;
} = {}): WithLogger<M2MGatewayAppContext<M2MAdminAuthData>> => {
  const correlationId = generateId<CorrelationId>();
  return {
    authData: {
      systemRole: systemRole.M2M_ADMIN_ROLE,
      organizationId: organizationId || generateId(),
      userId: generateId(),
      clientId: generateId(),
      jti: generateId(),
    },
    serviceName: serviceName || generateMock(z.string()),
    spanId: generateId(),
    logger: genericLogger,
    requestTimestamp: Date.now(),
    correlationId,
    headers: {
      "X-Correlation-Id": correlationId,
      Authorization: `Bearer ${m2mTestToken}`,
      "X-Forwarded-For": undefined,
    },
  };
};

export function getMockDownloadedDocument({
  mockFileName = "mockFileName.txt",
  mockContentType = "text/plain",
  mockFileContent = "This is a mock file content for testing purposes.\nIt simulates the content of an Eservice descriptor interface file.\nOn multiple lines.",
  prettyName = "Mock File Name",
  id = generateId(),
}: {
  id?: string;
  mockFileName?: string;
  mockContentType?: string;
  mockFileContent?: string;
  prettyName?: string;
} = {}): DownloadedDocument {
  return {
    id,
    file: new File([Buffer.from(mockFileContent)], mockFileName, {
      type: mockContentType,
    }),
    prettyName,
  };
}

export const buildRiskAnalysisSeed = (
  riskAnalysis: RiskAnalysis
): m2mGatewayApiV3.EServiceRiskAnalysisSeed => ({
  name: riskAnalysis.name,
  riskAnalysisForm: riskAnalysisFormToRiskAnalysisFormToValidate(
    riskAnalysis.riskAnalysisForm
  ),
});

export const buildEserviceTemplateRiskAnalysisSeed = (
  riskAnalysis: EServiceTemplateRiskAnalysis
): m2mGatewayApiV3.EServiceTemplateRiskAnalysisSeed => ({
  name: riskAnalysis.name,
  riskAnalysisForm: riskAnalysisFormToRiskAnalysisFormToValidate(
    riskAnalysis.riskAnalysisForm
  ),
  tenantKind: riskAnalysis.tenantKind,
});

export function testToM2MEServiceRiskAnalysisAnswers(
  riskAnalysisForm: catalogApi.EServiceRiskAnalysis["riskAnalysisForm"]
): m2mGatewayApiV3.EServiceRiskAnalysis["riskAnalysisForm"]["answers"] {
  const expectedSingleAnswers = riskAnalysisForm.singleAnswers.reduce<
    Record<string, string[]>
  >((singleAnswersMap, { key, value }) => {
    if (value) {
      singleAnswersMap[key] = [value];
    }
    return singleAnswersMap;
  }, {});

  const expectedMultiAnswers = riskAnalysisForm.multiAnswers.reduce<
    Record<string, string[]>
  >((multiAnswersMap, { key, values }) => {
    if (values.length > 0) {
      multiAnswersMap[key] = values;
    }
    return multiAnswersMap;
  }, {});

  return {
    ...expectedSingleAnswers,
    ...expectedMultiAnswers,
  };
}

export const getMockm2mGatewayApiV3CompactUser =
  (): m2mGatewayApiV3.CompactUser => ({
    userId: generateId(),
    name: generateMock(z.string()),
    familyName: generateMock(z.string()),
  });
