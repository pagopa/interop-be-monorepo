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
import {
  agreementApi,
  authorizationApi,
  catalogApi,
  m2mEventApi,
  m2mGatewayApiV3,
  purposeApi,
  purposeTemplateApi,
} from "pagopa-interop-api-clients";
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

export const testToM2mGatewayApiPurposeVersion = (
  version: purposeApi.PurposeVersion
): m2mGatewayApiV3.PurposeVersion => ({
  id: version.id,
  createdAt: version.createdAt,
  dailyCalls: version.dailyCalls,
  state: version.state,
  firstActivationAt: version.firstActivationAt,
  rejectionReason: version.rejectionReason,
  suspendedAt: version.suspendedAt,
  updatedAt: version.updatedAt,
});

export const testToM2mGatewayApiAgreement = (
  agreement: agreementApi.Agreement
): m2mGatewayApiV3.Agreement => ({
  id: agreement.id,
  eserviceId: agreement.eserviceId,
  descriptorId: agreement.descriptorId,
  producerId: agreement.producerId,
  consumerId: agreement.consumerId,
  delegationId: agreement.stamps.submission?.delegationId,
  state: agreement.state,
  suspendedByConsumer: agreement.suspendedByConsumer,
  suspendedByProducer: agreement.suspendedByProducer,
  suspendedByPlatform: agreement.suspendedByPlatform,
  consumerNotes: agreement.consumerNotes,
  rejectionReason: agreement.rejectionReason,
  createdAt: agreement.createdAt,
  updatedAt: agreement.updatedAt,
  suspendedAt: agreement.suspendedAt,
});

export const testToM2mGatewayApiEService = (
  eservice: catalogApi.EService
): m2mGatewayApiV3.EService => ({
  id: eservice.id,
  producerId: eservice.producerId,
  name: eservice.name,
  description: eservice.description,
  technology: eservice.technology,
  mode: eservice.mode,
  isSignalHubEnabled: eservice.isSignalHubEnabled,
  isConsumerDelegable: eservice.isConsumerDelegable,
  isClientAccessDelegable: eservice.isClientAccessDelegable,
  templateId: eservice.templateId,
  personalData: eservice.personalData,
});

export const testToM2mGatewayApiEServiceEvent = (
  eserviceEvent: m2mEventApi.EServiceM2MEvent
): m2mGatewayApiV3.EServiceEvent => ({
  id: eserviceEvent.id,
  eserviceId: eserviceEvent.eserviceId,
  eventType: eserviceEvent.eventType,
  eventTimestamp: eserviceEvent.eventTimestamp,
  descriptorId: eserviceEvent.descriptorId,
  producerDelegationId: eserviceEvent.producerDelegationId,
});

export const testToM2mGatewayApiEServiceTemplateEvent = (
  eserviceTemplateEvent: m2mEventApi.EServiceTemplateM2MEvent
): m2mGatewayApiV3.EServiceTemplateEvent => ({
  id: eserviceTemplateEvent.id,
  eventTimestamp: eserviceTemplateEvent.eventTimestamp,
  eventType: eserviceTemplateEvent.eventType,
  eserviceTemplateId: eserviceTemplateEvent.eserviceTemplateId,
  eserviceTemplateVersionId: eserviceTemplateEvent.eserviceTemplateVersionId,
});

export const testToM2mGatewayApiPurpose = (
  purpose: purposeApi.Purpose,
  {
    currentVersion,
    waitingForApprovalVersion,
    rejectedVersion,
  }: {
    currentVersion?: m2mGatewayApiV3.PurposeVersion;
    waitingForApprovalVersion?: m2mGatewayApiV3.PurposeVersion;
    rejectedVersion?: m2mGatewayApiV3.PurposeVersion;
  }
): m2mGatewayApiV3.Purpose => ({
  id: purpose.id,
  eserviceId: purpose.eserviceId,
  consumerId: purpose.consumerId,
  suspendedByConsumer: purpose.suspendedByConsumer,
  suspendedByProducer: purpose.suspendedByProducer,
  title: purpose.title,
  description: purpose.description,
  createdAt: purpose.createdAt,
  updatedAt: purpose.updatedAt,
  isRiskAnalysisValid: purpose.isRiskAnalysisValid,
  isFreeOfCharge: purpose.isFreeOfCharge,
  freeOfChargeReason: purpose.freeOfChargeReason,
  delegationId: purpose.delegationId,
  currentVersion,
  waitingForApprovalVersion,
  rejectedVersion,
  purposeTemplateId: purpose.purposeTemplateId,
});

export const testToM2MJWK = (
  key: authorizationApi.JWKKey
): m2mGatewayApiV3.JWK => ({
  kid: key.kid,
  kty: key.kty,
  "x5t#S256": key["x5t#S256"],
  alg: key.alg,
  crv: key.crv,
  d: key.d,
  dp: key.dp,
  dq: key.dq,
  e: key.e,
  k: key.k,
  key_ops: key.key_ops,
  n: key.n,
  oth: key.oth,
  p: key.p,
  q: key.q,
  qi: key.qi,
  use: key.use,
  x: key.x,
  x5c: key.x5c,
  x5t: key.x5t,
  x5u: key.x5u,
  y: key.y,
});

export const testToM2MKey = ({
  clientId,
  jwk,
}: authorizationApi.ClientJWK): m2mGatewayApiV3.Key => ({
  clientId,
  jwk: testToM2MJWK(jwk),
});

export const testToM2MProducerKey = ({
  jwk,
  producerKeychainId,
}: authorizationApi.ProducerJWK): m2mGatewayApiV3.ProducerKey => ({
  producerKeychainId,
  jwk: testToM2MJWK(jwk),
});

export const testToM2MRiskAnalysisTemplateAnswer = (
  answer: purposeTemplateApi.RiskAnalysisTemplateAnswer
): m2mGatewayApiV3.RiskAnalysisTemplateAnswer => ({
  id: answer.id,
  values: answer.values,
  editable: answer.editable,
  annotationText: answer.annotation ? answer.annotation.text : undefined,
  suggestedValues: answer.suggestedValues,
});
