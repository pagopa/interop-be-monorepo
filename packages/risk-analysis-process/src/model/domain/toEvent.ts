import { CreateEvent } from "pagopa-interop-commons";
import {
  CorrelationId,
  StandaloneRiskAnalysis,
  RiskAnalysisEvent,
  toStandaloneRiskAnalysisV2,
} from "pagopa-interop-models";

export const toCreateEventRiskAnalysisCreated = (
  riskAnalysis: StandaloneRiskAnalysis,
  correlationId: CorrelationId
): CreateEvent<RiskAnalysisEvent> => ({
  streamId: riskAnalysis.id,
  version: undefined,
  correlationId,
  event: {
    type: "RiskAnalysisCreated",
    event_version: 2,
    data: {
      riskAnalysis: toStandaloneRiskAnalysisV2(riskAnalysis),
    },
  },
});

export const toCreateEventRiskAnalysisUpdated = (
  riskAnalysis: StandaloneRiskAnalysis,
  version: number,
  correlationId: CorrelationId
): CreateEvent<RiskAnalysisEvent> => ({
  streamId: riskAnalysis.id,
  version,
  correlationId,
  event: {
    type: "RiskAnalysisUpdated",
    event_version: 2,
    data: {
      riskAnalysis: toStandaloneRiskAnalysisV2(riskAnalysis),
    },
  },
});

export const toCreateEventRiskAnalysisDeleted = (
  riskAnalysis: StandaloneRiskAnalysis,
  version: number,
  correlationId: CorrelationId
): CreateEvent<RiskAnalysisEvent> => ({
  streamId: riskAnalysis.id,
  version,
  correlationId,
  event: {
    type: "RiskAnalysisDeleted",
    event_version: 2,
    data: {
      riskAnalysisId: riskAnalysis.id,
      riskAnalysis: toStandaloneRiskAnalysisV2(riskAnalysis),
    },
  },
});
