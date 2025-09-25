import { bffApi } from "pagopa-interop-api-clients";
import { assertFeatureFlagEnabled, WithLogger } from "pagopa-interop-commons";
import { PurposeTemplateId } from "pagopa-interop-models";
import { PurposeTemplateProcessClient } from "../clients/clientsProvider.js";
import { BffAppContext } from "../utilities/context.js";
import { config } from "../config/config.js";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function purposeTemplateServiceBuilder(
  purposeTemplateClient: PurposeTemplateProcessClient
) {
  return {
    async createPurposeTemplate(
      seed: bffApi.PurposeTemplateSeed,
      { logger, headers }: WithLogger<BffAppContext>
    ): Promise<bffApi.CreatedResource> {
      assertFeatureFlagEnabled(config, "featureFlagPurposeTemplate");
      logger.info(`Creating purpose template`);
      const result = await purposeTemplateClient.createPurposeTemplate(seed, {
        headers,
      });

      return { id: result.id };
    },
    async createRiskAnalysisAnswer(
      purposeTemplateId: PurposeTemplateId,
      seed: bffApi.RiskAnalysisTemplateAnswerRequest,
      { logger, headers }: WithLogger<BffAppContext>
    ): Promise<bffApi.RiskAnalysisTemplateAnswer> {
      logger.info(
        `Creating risk analysis answer for purpose template ${purposeTemplateId}`
      );
      assertFeatureFlagEnabled(config, "featureFlagPurposeTemplate");
      return await purposeTemplateClient.addRiskAnalysisAnswerForPurposeTemplate(
        seed,
        {
          params: {
            id: purposeTemplateId,
          },
          headers,
        }
      );
    },
  };
}

export type PurposeTemplateService = ReturnType<
  typeof purposeTemplateServiceBuilder
>;
