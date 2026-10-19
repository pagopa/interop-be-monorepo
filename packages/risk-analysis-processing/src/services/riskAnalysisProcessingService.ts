import type { purposeApi } from "pagopa-interop-api-clients";

import { RefreshableInteropToken } from "pagopa-interop-commons";
import { CorrelationId } from "pagopa-interop-models";

import { ReadModelServiceSQL } from "./readModelServiceSQL.js";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
const getHeaders = (correlationId: CorrelationId, token: string) => ({
  "X-Correlation-Id": correlationId,
  Authorization: `Bearer ${token}`,
});

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function riskAnalysisProcessingServiceBuilder(
  readModelService: ReadModelServiceSQL,
  purposeProcessClient: purposeApi.PurposeProcessClient,
  refreshableToken: RefreshableInteropToken,
  correlationId: CorrelationId
) {
  return {
    async processPurposeReviewerWorkflows(): Promise<{
      processed: {
        riskAnalyses: number;
      };
    }> {
      const token = (await refreshableToken.get()).serialized;
      const headers = getHeaders(correlationId, token);

      const purposeIds =
        await readModelService.getAllReadModelPurposeIdsWithLegacyReviewMode();

      for (const purposeId of purposeIds) {
        await purposeProcessClient.fixReviewerWorkflow(undefined, {
          headers,
          params: {
            purposeId,
          },
        });
      }

      return { processed: { riskAnalyses: purposeIds.length } };
    },
  };
}
