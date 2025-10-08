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
import {
  PurposeTemplateDeletingSchema,
  PurposeTemplateItemsSchema,
} from "../../model/purposeTemplate/purposeTemplate.js";
import { purposeTemplateServiceBuilder } from "../../service/purposeTemplateService.js";
import {
  PurposeTemplateEServiceDescriptorDeletingSchema,
  PurposeTemplateEServiceDescriptorSchema,
} from "../../model/purposeTemplate/purposeTemplateEserviceDescriptor.js";

export async function handlePurposeTemplateMessageV2(
  messages: PurposeTemplateEventEnvelope[],
  dbContext: DBContext
): Promise<void> {
  const purposeTemplateService = purposeTemplateServiceBuilder(dbContext);

  const upsertPurposeTemplateBatch: PurposeTemplateItemsSchema[] = [];
  const deletePurposeTemplateBatch: PurposeTemplateDeletingSchema[] = [];
  const upsertPurposeTemplateEserviceDescriptorBatch: PurposeTemplateEServiceDescriptorSchema[] =
    [];
  const deletePurposeTemplateEserviceDescriptorBatch: PurposeTemplateEServiceDescriptorDeletingSchema[] =
    [];

  for (const message of messages) {
    await match(message)
      .with(
        {
          type: P.union(
            "PurposeTemplateAdded",
            "PurposeTemplateAnnotationDocumentAdded",
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

        const purposeTemplate = fromPurposeTemplateV2(msg.data.purposeTemplate);

        deletePurposeTemplateBatch.push(
          PurposeTemplateDeletingSchema.parse({
            id: purposeTemplate.id,
            deleted: true,
          } satisfies z.input<typeof PurposeTemplateDeletingSchema>)
        );
      })
      .with({ type: "PurposeTemplateEServiceLinked" }, async (msg) => {
        if (!msg.data.purposeTemplate) {
          throw missingKafkaMessageDataError("purposeTemplate", msg.type);
        }
        if (!msg.data.eservice) {
          throw missingKafkaMessageDataError("eservice", msg.type);
        }

        upsertPurposeTemplateEserviceDescriptorBatch.push(
          PurposeTemplateEServiceDescriptorSchema.parse({
            purposeTemplateId: msg.data.purposeTemplate.id,
            eserviceId: msg.data.eservice.id,
            descriptorId: msg.data.descriptorId,
            createdAt: new Date().toISOString(),
            metadataVersion: msg.version,
          } satisfies z.input<typeof PurposeTemplateEServiceDescriptorSchema>)
        );
      })
      .with({ type: "PurposeTemplateEServiceUnlinked" }, async (msg) => {
        if (!msg.data.purposeTemplate) {
          throw missingKafkaMessageDataError("purposeTemplate", msg.type);
        }
        if (!msg.data.eservice) {
          throw missingKafkaMessageDataError("eservice", msg.type);
        }

        deletePurposeTemplateEserviceDescriptorBatch.push(
          PurposeTemplateEServiceDescriptorDeletingSchema.parse({
            purposeTemplateId: msg.data.purposeTemplate.id,
            eserviceId: msg.data.eservice.id,
            descriptorId: msg.data.descriptorId,
            deleted: true,
          } satisfies z.input<typeof PurposeTemplateEServiceDescriptorDeletingSchema>)
        );
      })
      .exhaustive();
  }

  if (upsertPurposeTemplateBatch.length > 0) {
    await purposeTemplateService.upsertBatchPurposeTemplate(
      dbContext,
      upsertPurposeTemplateBatch
    );
  }

  if (upsertPurposeTemplateEserviceDescriptorBatch.length > 0) {
    await purposeTemplateService.upsertBatchTemplateEServiceDescriptor(
      dbContext,
      upsertPurposeTemplateEserviceDescriptorBatch
    );
  }

  if (deletePurposeTemplateBatch.length > 0) {
    await purposeTemplateService.deleteBatchPurposeTemplate(
      dbContext,
      deletePurposeTemplateBatch
    );
  }

  if (deletePurposeTemplateEserviceDescriptorBatch.length > 0) {
    await purposeTemplateService.deleteBatchTemplateEServiceDescriptor(
      dbContext,
      deletePurposeTemplateEserviceDescriptorBatch
    );
  }
}
