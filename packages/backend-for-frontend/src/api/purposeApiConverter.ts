import { bffApi, purposeApi } from "pagopa-interop-api-clients";

export function toBffApiRiskAnalysisForm(
  riskAnalysisForm: purposeApi.RiskAnalysisForm
): bffApi.RiskAnalysisForm {
  return {
    version: riskAnalysisForm.version,
    answers: riskAnalysisForm.answers,
    riskAnalysisId: riskAnalysisForm.riskAnalysisId,
  };
}

function toBffApiPurposeVersionDocument(
  riskAnalysis: purposeApi.PurposeVersionDocument
): bffApi.PurposeVersionDocument {
  return {
    id: riskAnalysis.id,
    contentType: riskAnalysis.contentType,
    createdAt: riskAnalysis.createdAt,
  };
}
function toBffApiPurposeVersionSignedDocument(
  signedContract: purposeApi.PurposeVersionSignedDocument
): bffApi.PurposeVersionSignedDocument {
  return {
    id: signedContract.id,
    contentType: signedContract.contentType,
    createdAt: signedContract.createdAt,
    signedAt: signedContract.signedAt,
  };
}

export function toBffApiPurposeVersion(
  purposeVersion: purposeApi.PurposeVersion
): bffApi.PurposeVersion {
  return {
    id: purposeVersion.id,
    state: purposeVersion.state,
    createdAt: purposeVersion.createdAt,
    suspendedAt: purposeVersion.suspendedAt,
    updatedAt: purposeVersion.updatedAt,
    firstActivationAt: purposeVersion.firstActivationAt,
    dailyCalls: purposeVersion.dailyCalls,
    riskAnalysisDocument:
      purposeVersion.riskAnalysis &&
      toBffApiPurposeVersionDocument(purposeVersion.riskAnalysis),
    rejectionReason: purposeVersion.rejectionReason,
    signedContract:
      purposeVersion.signedContract &&
      toBffApiPurposeVersionSignedDocument(purposeVersion.signedContract),
  };
}

export function toBffProducerDashboardSaturation(
  saturation: purposeApi.ProducerDashboardSaturation
): bffApi.ProducerDashboardSaturation {
  return {
    summary: saturation.summary,
    results: saturation.results.map((r) => ({
      eservice: { id: r.eservice.id, name: r.eservice.name },
      descriptorId: r.descriptorId,
      version: r.version,
      activePurposesCount: r.activePurposesCount,
      approvedDailyCalls: r.approvedDailyCalls,
      dailyCallsTotal: r.dailyCallsTotal,
      percentage: r.percentage,
      waitingForApprovalDailyCalls: r.waitingForApprovalDailyCalls,
    })),
    pagination: saturation.pagination,
  };
}

export function toBffProducerEServiceMonitoringSaturation(
  saturation: purposeApi.ProducerEServiceMonitoringSaturation
): bffApi.ProducerEServiceMonitoringSaturation {
  return {
    eservice: saturation.eservice,
    version: saturation.version,
    otherVersions: saturation.otherVersions,
    dailyCallsPerConsumer: saturation.dailyCallsPerConsumer,
    dailyCallsTotal: saturation.dailyCallsTotal,
    customizedQuotaConsumers: saturation.customizedQuotaConsumers,
    activeConsumers: saturation.activeConsumers,
    results: saturation.results.map((result) => ({
      consumer: result.consumer,
      activePurposesCount: result.activePurposesCount,
      approvedDailyCalls: result.approvedDailyCalls,
      dailyCallsPerConsumer: result.dailyCallsPerConsumer,
      percentage: result.percentage,
      waitingForApprovalDailyCalls: result.waitingForApprovalDailyCalls,
    })),
    pagination: saturation.pagination,
  };
}

export function toBffProducerEServiceMonitoringConsumerPurposes(
  consumerPurposes: purposeApi.ProducerEServiceMonitoringConsumerPurposes
): bffApi.ProducerEServiceMonitoringConsumerPurposes {
  return {
    eservice: consumerPurposes.eservice,
    version: consumerPurposes.version,
    consumer: consumerPurposes.consumer,
    dailyCallsPerConsumer: consumerPurposes.dailyCallsPerConsumer,
    customizedByAttribute: consumerPurposes.customizedByAttribute,
    approvedDailyCalls: consumerPurposes.approvedDailyCalls,
    percentage: consumerPurposes.percentage,
    waitingForApprovalPurposes: consumerPurposes.waitingForApprovalPurposes,
    results: consumerPurposes.results.map((result) => ({
      purposeId: result.purposeId,
      title: result.title,
      dailyCalls: result.dailyCalls,
      state: result.state,
      suspendedByConsumer: result.suspendedByConsumer,
      suspendedByProducer: result.suspendedByProducer,
      updatedAt: result.updatedAt,
      hasPendingQuotaChange: result.hasPendingQuotaChange,
    })),
    pagination: consumerPurposes.pagination,
  };
}
