/* eslint-disable max-params */
import { randomUUID } from "crypto";
import { bffApi, purposeTemplateApi } from "pagopa-interop-api-clients";
import {
  assertFeatureFlagEnabled,
  FileManager,
  validateAndStorePDFDocument,
  WithLogger,
} from "pagopa-interop-commons";
import { PurposeTemplateProcessClient } from "../clients/clientsProvider.js";
import { config } from "../config/config.js";
import { BffAppContext } from "../utilities/context.js";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function purposeTemplateServiceBuilder(
  purposeTemplateClient: PurposeTemplateProcessClient,
  fileManager: FileManager
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
    async addRiskAnalysisTemplateAnswerAnnotationDocument(
      purposeTemplateId: string,
      answerId: string,
      body: bffApi.addRiskAnalysisTemplateAnswerAnnotationDocument_Body,
      { logger, headers }: WithLogger<BffAppContext>
    ): Promise<bffApi.RiskAnalysisTemplateAnswerAnnotationDocument> {
      logger.info(
        `Adding annotation document to purpose template with id ${purposeTemplateId}`
      );
      assertFeatureFlagEnabled(config, "featureFlagPurposeTemplate");

      const documentId = randomUUID();

      return await validateAndStorePDFDocument(
        fileManager,
        purposeTemplateId,
        body.doc,
        documentId,
        config.riskAnalysisDocumentsContainer,
        config.riskAnalysisDocumentsPath,
        body.prettyName,
        async (
          documentId: string,
          fileName: string,
          filePath: string,
          prettyName: string,
          contentType: string,
          checksum: string
        ): Promise<purposeTemplateApi.RiskAnalysisTemplateAnswerAnnotationDocument> =>
          await purposeTemplateClient.addRiskAnalysisTemplateAnswerAnnotationDocument(
            {
              documentId,
              name: fileName,
              path: filePath,
              prettyName,
              contentType,
              checksum,
            },
            {
              headers,
              params: {
                id: purposeTemplateId,
                answerId,
              },
            }
          ),
        logger
      );
    },
  };
}

export type PurposeTemplateService = ReturnType<
  typeof purposeTemplateServiceBuilder
>;
