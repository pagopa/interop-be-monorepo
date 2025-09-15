import { purposeTemplateApi } from "pagopa-interop-api-clients";
import {
  PurposeTemplate,
  RiskAnalysisFormTemplate,
  RiskAnalysisTemplateAnswerAnnotationDocument,
} from "pagopa-interop-models";
import { FileManager, Logger } from "pagopa-interop-commons";
import { config } from "../config/config.js";

/**
 * Finds answer IDs in the RiskAnalysisFormTemplate that are not present
 * in the provided seed of answers in the PurposeTemplateSeed.
 *
 * This function identify document's annotations linked to answers
 * that have been removed in the update operation.
 */

function findRemovedAnswerWithAnnotationDocs(
  updatedFormTemplate: purposeTemplateApi.PurposeTemplateSeed,
  formTemplate: RiskAnalysisFormTemplate | undefined
): RiskAnalysisTemplateAnswerAnnotationDocument[] {
  if (!formTemplate) {
    return [];
  }

  const incomingAnswersIds = new Set(
    Object.keys(updatedFormTemplate.purposeRiskAnalysisForm?.answers || {})
  );

  return [...formTemplate.singleAnswers, ...formTemplate.multiAnswers]
    .filter((answer) => !incomingAnswersIds.has(answer.id))
    .flatMap((answer) => answer.annotation?.docs || []);
}

export async function cleanupAnnotationDocsForRemovedAnswers(
  purposetemplateSeed: purposeTemplateApi.PurposeTemplateSeed,
  purposeTemplate: PurposeTemplate,
  fileManager: FileManager,
  logger: Logger
): Promise<void> {
  const annotationDocs = findRemovedAnswerWithAnnotationDocs(
    purposetemplateSeed,
    purposeTemplate.purposeRiskAnalysisForm
  );

  const filesToDelete = annotationDocs.map(async (doc) =>
    fileManager.delete(config.s3Bucket, doc.path, logger)
  );

  try {
    await Promise.all(filesToDelete);
  } catch (error) {
    // S3 file deletion errors aren't critical for the main flow
    logger.error(`Error deleting annotation files: ${error}`);
  }
}
