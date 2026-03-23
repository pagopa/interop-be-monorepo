import { CorrelationId } from "pagopa-interop-models";
import type {
  catalogApi,
  eserviceTemplateApi,
  purposeApi,
} from "pagopa-interop-api-clients";
import { RefreshableInteropToken } from "pagopa-interop-commons";
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
  purposeProcessClient: purposeApi.PurposeProcessClient,
  eserviceTemplateProcessClient: eserviceTemplateApi.EServiceTemplateProcessClient,
  refreshableToken: RefreshableInteropToken,
  correlationId: CorrelationId
) {
  return {
    async processEServiceRiskAnalyses(): Promise<{
      processed: {
        eservices: number;
        riskAnalyses: number;
      };
    }> {
      const token = (await refreshableToken.get()).serialized;
      const headers = getHeaders(correlationId, token);

      const eservices =
        await readModelService.getAllReadModelEServicesWithEmptyTenantKindRAs();

      let riskAnalysisCount = 0;
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

          riskAnalysisCount += 1;
        }
      }

      return {
        processed: {
          eservices: eservices.length,
          riskAnalyses: riskAnalysisCount,
        },
      };
    },
    async processPurposeRiskAnalyses(): Promise<{
      processed: {
        riskAnalyses: number;
      };
    }> {
      const token = (await refreshableToken.get()).serialized;
      const headers = getHeaders(correlationId, token);

      const purposes =
        await readModelService.getAllReadModelPurposesWithoutTenantKind();

      for (const singlePurpose of purposes) {
        await purposeProcessClient.fixPurposeRiskAnalysisTenantKind(undefined, {
          headers,
          params: {
            purposeId: singlePurpose.id,
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            riskAnalysisId: singlePurpose.riskAnalysisForm!.id,
          },
        });
      }

      return { processed: { riskAnalyses: purposes.length } };
    },
    async processEServiceTemplateRiskAnalyses(): Promise<{
      processed: {
        eserviceTemplates: number;
        riskAnalyses: number;
      };
    }> {
      const token = (await refreshableToken.get()).serialized;
      const headers = getHeaders(correlationId, token);

      const eserviceTemplates =
        await readModelService.getAllReadModelEServiceTemplates();

      let riskAnalysisCount = 0;
      for (const singleEServiceTemplate of eserviceTemplates) {
        for (const riskAnalysis of singleEServiceTemplate.riskAnalysis) {
          await eserviceTemplateProcessClient.fixEServiceTemplateRiskAnalysisTenantKind(
            undefined,
            {
              headers,
              params: {
                eServiceTemplateId: singleEServiceTemplate.id,
                riskAnalysisId: riskAnalysis.id,
              },
            }
          );

          riskAnalysisCount += 1;
        }
      }

      return {
        processed: {
          eserviceTemplates: eserviceTemplates.length,
          riskAnalyses: riskAnalysisCount,
        },
      };
    },
  };
}

export type RiskAnalysisProcessingService = ReturnType<
  typeof riskAnalysisProcessingServiceBuilder
>;
