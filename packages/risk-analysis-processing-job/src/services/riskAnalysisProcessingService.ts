import { CorrelationId } from "pagopa-interop-models";
import type { catalogApi } from "pagopa-interop-api-clients";
import { Logger, RefreshableInteropToken } from "pagopa-interop-commons";
import { ReadModelServiceSQL } from "./readModelServiceSQL.js";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
const getHeaders = (correlationId: CorrelationId, token: string) => ({
  "X-Correlation-Id": correlationId,
  Authorization: `Bearer ${token}`,
});

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function riskAnalysisProcessingServiceBuilder(
  readModelService: ReadModelServiceSQL,
  catalogProcessClient: catalogApi.CatalogProcessClient,
  refreshableToken: RefreshableInteropToken,
  logger: Logger,
  correlationId: CorrelationId
) {
  return {
    async processEServiceRiskAnalyses(): Promise<void> {
      const token = (await refreshableToken.get()).serialized;
      const headers = getHeaders(correlationId, token);

      const eservices =
        await readModelService.getAllReadModelEServicesWithEmptyTenantKindRAs();

      for (const singleEService of eservices) {
        for (const riskAnalysis of singleEService.riskAnalysis) {
          await catalogProcessClient.fixEServiceRiskAnalysisTenantKind(
            undefined,
            {
              headers,
              params: {
                eServiceId: singleEService.id,
                riskAnalysisId: riskAnalysis.id,
              },
            }
          );
        }
      }
    },
  };
}

export type RiskAnalysisProcessingService = ReturnType<
  typeof riskAnalysisProcessingServiceBuilder
>;
