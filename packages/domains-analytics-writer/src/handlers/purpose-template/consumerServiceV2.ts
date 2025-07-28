/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable functional/immutable-data */
/* eslint-disable sonarjs/cognitive-complexity */
import {
  PurposeTemplateEventEnvelope,
  missingKafkaMessageDataError,
} from "pagopa-interop-models";
import { match, P } from "ts-pattern";
import { z } from "zod";
import { DBContext } from "../../db/db.js";
import { PurposeTemplateItemsSchema } from "../../model/purposeTemplate/purposeTemplate.js";
import {
  fromPurposeTemplateV2,
  splitPurposeTemplateIntoObjectsSQL,
} from "../../utils/splitPurposeTemplateIntoObjectsSQL.js";
import { purposeTemplateServiceBuilder } from "../../service/purposeTemplateService.js";

export async function handlePurposeTemplateMessageV2(
  messages: PurposeTemplateEventEnvelope[],
  dbContext: DBContext
): Promise<void> {
  const purposeTemplateService = purposeTemplateServiceBuilder(dbContext);

  const upsertPurposeTemplateBatch: PurposeTemplateItemsSchema[] = [];

  for (const message of messages) {
    match(message)
      .with(
        {
          type: P.union(
            "PurposeTemplatePublished",
            "PurposeTemplateAdded",
            "PurposeTemplateUnsuspended",
            "PurposeTemplateSuspended",
            "PurposeTemplateArchived",
            "PurposeTemplateDraftUpdated",
            "PurposeTemplateDraftDeleted"
          ),
        },
        (msg) => {
          const purposeTemplateV2 = message.data.purposeTemplate;
          if (!purposeTemplateV2) {
            throw missingKafkaMessageDataError("purposeTemplate", message.type);
          }

          const splitResult = splitPurposeTemplateIntoObjectsSQL(
            fromPurposeTemplateV2(purposeTemplateV2),
            msg.version
          );

          upsertPurposeTemplateBatch.push(
            PurposeTemplateItemsSchema.parse({
              purposeTemplateSQL: splitResult.purposeTemplateSQL,
              eserviceDescriptorVersionsSQL:
                splitResult.eserviceDescriptorVersionsSQL,
              riskAnalysisFormSQL: splitResult.riskAnalysisFormSQL,
              riskAnalysisAnswersSQL: splitResult.riskAnalysisAnswersSQL,
              riskAnalysisAnswerAnnotationsSQL:
                splitResult.riskAnalysisAnswerAnnotationsSQL,
              riskAnalysisAnswerAnnotationDocumentsSQL:
                splitResult.riskAnalysisAnswerAnnotationDocumentsSQL,
            } satisfies z.input<typeof PurposeTemplateItemsSchema>)
          );
        }
      )
      .exhaustive();
  }

  if (upsertPurposeTemplateBatch.length > 0) {
    await purposeTemplateService.upsertBatchPurposeTemplate(
      dbContext,
      upsertPurposeTemplateBatch
    );
  }
}
