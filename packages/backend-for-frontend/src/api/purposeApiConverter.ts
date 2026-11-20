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
