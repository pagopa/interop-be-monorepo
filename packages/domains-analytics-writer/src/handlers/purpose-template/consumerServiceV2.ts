/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable functional/immutable-data */
/* eslint-disable sonarjs/cognitive-complexity */
import {
  PurposeTemplateEventEnvelope,
  fromPurposeTemplateV2,
  missingKafkaMessageDataError,
} from "pagopa-interop-models";
import { match, P } from "ts-pattern";
import { z } from "zod";
import { splitPurposeTemplateIntoObjectsSQL } from "pagopa-interop-readmodel";
import { DBContext } from "../../db/db.js";
import { PurposeTemplateItemsSchema } from "../../model/purposeTemplate/purposeTemplate.js";
import { purposeTemplateServiceBuilder } from "../../service/purposeTemplateService.js";

export async function handlePurposeTemplateMessageV2(
  messages: PurposeTemplateEventEnvelope[],
  dbContext: DBContext
): Promise<void> {
  const purposeTemplateService = purposeTemplateServiceBuilder(dbContext);

  const upsertPurposeTemplateBatch: PurposeTemplateItemsSchema[] = [];

  for (const message of messages) {
    await match(message)
      .with(
        {
          type: P.union(
            "PurposeTemplateAdded",
            "PurposeTemplateDraftUpdated",
            "PurposeTemplatePublished",
            "PurposeTemplateUnsuspended",
            "PurposeTemplateSuspended",
            "PurposeTemplateArchived"
          ),
        },
        (msg) => {
          const purposeTemplateV2 = msg.data.purposeTemplate;
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
              riskAnalysisFormTemplateSQL:
                splitResult.riskAnalysisFormTemplateSQL,
              riskAnalysisTemplateAnswersSQL:
                splitResult.riskAnalysisTemplateAnswersSQL,
              riskAnalysisTemplateAnswersAnnotationsSQL:
                splitResult.riskAnalysisTemplateAnswersAnnotationsSQL,
              riskAnalysisTemplateAnswersAnnotationsDocumentsSQL:
                splitResult.riskAnalysisTemplateAnswersAnnotationsDocumentsSQL,
            } satisfies z.input<typeof PurposeTemplateItemsSchema>)
          );
        }
      )
      .with({ type: "PurposeTemplateDraftDeleted" }, async (msg) => {
        if (!msg.data.purposeTemplate) {
          throw missingKafkaMessageDataError("purposeTemplate", msg.type);
        }

        // const purposeTemplate = fromPurposeTemplateV2(msg.data.purposeTemplate);

        // TODO: delete batch
      })
      .with({ type: "PurposeTemplateEServiceLinked" }, async (_msg) => {
        // TODO: partial batch purposeTemplateWriterService.upsertPurposeTemplateEServiceDescriptor
      })
      .with({ type: "PurposeTemplateEServiceUnlinked" }, async (_msg) => {
        // TODO: partial batch purposeTemplateWriterService.deletePurposeTemplateEServiceDescriptorsByEServiceIdAndDescriptorId
      })
      .exhaustive();
  }

  if (upsertPurposeTemplateBatch.length > 0) {
    await purposeTemplateService.upsertBatchPurposeTemplate(
      dbContext,
      upsertPurposeTemplateBatch
    );
  }
}
