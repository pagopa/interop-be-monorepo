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
            "PurposeTemplateDraftDeleted",
            "PurposeTemplatePublished",
            "PurposeTemplateUnsuspended",
            "PurposeTemplateSuspended",
            "PurposeTemplateArchived"
          ),
        },
        (msg) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const purposeTemplateV2 = (message.data as any).purposeTemplate; // TODO: remove any casting
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
      .with(
        {
          type: P.union(
            "PurposeTemplateEServiceLinked",
            "PurposeTemplateEServiceUnlinked"
          ),
        },
        async (_msg) => {
          // eslint-disable-next-line @typescript-eslint/no-floating-promises
          await Promise.resolve();
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
