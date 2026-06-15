import { CorrelationId, EServiceTemplateId } from "pagopa-interop-models";
import type {
  catalogApi,
  eserviceTemplateApi,
  purposeApi,
} from "pagopa-interop-api-clients";
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
  purposeProcessClient: purposeApi.PurposeProcessClient,
  eserviceTemplateProcessClient: eserviceTemplateApi.EServiceTemplateProcessClient,
  refreshableToken: RefreshableInteropToken,
  correlationId: CorrelationId,
  loggerInstance: Logger
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
        skipped: number;
      };
    }> {
      const token = (await refreshableToken.get()).serialized;
      const headers = getHeaders(correlationId, token);

      const purposes =
        await readModelService.getAllReadModelPurposesWithoutTenantKind();

      const purposesToProcess = (
        await Promise.all(
          purposes.map(async (p) => {
            const hasEntry = await readModelService.hasTenantKindHistoryEntry(
              p.consumerId
            );
            if (!hasEntry) {
              loggerInstance.warn(
                `Purpose ${p.id} skipped: consumerId ${p.consumerId} has no entry in tenantKindHistory db`
              );
              return undefined;
            }
            return p.id;
          })
        )
      ).filter((p): p is NonNullable<typeof p> => p !== undefined);

      const skippedCount = purposes.length - purposesToProcess.length;

      for (const purposeId of purposesToProcess) {
        await purposeProcessClient.fixPurposeRiskAnalysisTenantKind(undefined, {
          headers,
          params: {
            purposeId: purposeId,
          },
        });
      }

      return {
        processed: {
          riskAnalyses: purposesToProcess.length,
          skipped: skippedCount,
        },
      };
    },
    async processEServiceTemplateRiskAnalyses(
      templates: EServiceTemplateId[]
    ): Promise<{
      processed: {
        eserviceTemplates: number;
        riskAnalyses: number;
      };
    }> {
      const token = (await refreshableToken.get()).serialized;
      const headers = getHeaders(correlationId, token);

      const eserviceTemplates =
        await readModelService.getReadModelEServiceTemplates(templates);

      let riskAnalysisCount = 0;
      for (const singleEServiceTemplate of eserviceTemplates) {
        for (const riskAnalysis of singleEServiceTemplate.riskAnalysis) {
          await eserviceTemplateProcessClient.fixEServiceTemplateRiskAnalysisTenantKind(
            undefined,
            {
              headers,
              params: {
                templateId: singleEServiceTemplate.id,
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
