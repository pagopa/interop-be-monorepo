/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable functional/immutable-data */
/* eslint-disable sonarjs/cognitive-complexity */
import {
  PurposeTemplateEserviceTemplateVersionSchema,
  PurposeTemplateItemsSchema,
  PurposeTemplateEServiceDescriptorSchema,
} from "pagopa-interop-kpi-models";
import {
  bigIntToDate,
  PurposeTemplateEventEnvelope,
  fromPurposeTemplateV2,
  missingKafkaMessageDataError,
  unsafeBrandId,
} from "pagopa-interop-models";
import { splitPurposeTemplateIntoObjectsSQL } from "pagopa-interop-readmodel";
import { match, P } from "ts-pattern";
import { z } from "zod";

import { DBContext } from "../../db/db.js";
import { PurposeTemplateDeletingSchema } from "../../model/purposeTemplate/purposeTemplate.js";
import { PurposeTemplateEServiceDescriptorDeletingSchema } from "../../model/purposeTemplate/purposeTemplateEserviceDescriptor.js";
import { PurposeTemplateEserviceTemplateVersionDeletingSchema } from "../../model/purposeTemplate/purposeTemplateEserviceTemplateVersion.js";
import { purposeTemplateServiceBuilder } from "../../service/purposeTemplateService.js";

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
  const upsertPurposeTemplateEserviceTemplateVersionBatch: PurposeTemplateEserviceTemplateVersionSchema[] =
    [];
  const deletePurposeTemplateEserviceTemplateVersionBatch: PurposeTemplateEserviceTemplateVersionDeletingSchema[] =
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
            "PurposeTemplateArchived",
            "PurposeTemplateAnnotationDocumentDeleted",
            "PurposeTemplateAnnotationDocumentUpdated",
            "RiskAnalysisTemplateDocumentGenerated",
            "RiskAnalysisTemplateSignedDocumentGenerated"
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
          } satisfies z.input<
            typeof PurposeTemplateEServiceDescriptorDeletingSchema
          >)
        );
      })
      .with({ type: "PurposeTemplateEServiceTemplateLinked" }, async (msg) => {
        if (!msg.data.purposeTemplate) {
          throw missingKafkaMessageDataError("purposeTemplate", msg.type);
        }
        if (!msg.data.eserviceTemplate) {
          throw missingKafkaMessageDataError("eserviceTemplate", msg.type);
        }

        upsertPurposeTemplateEserviceTemplateVersionBatch.push(
          PurposeTemplateEserviceTemplateVersionSchema.parse({
            purposeTemplateId: unsafeBrandId(msg.data.purposeTemplate.id),
            eserviceTemplateId: unsafeBrandId(msg.data.eserviceTemplate.id),
            eserviceTemplateVersionId: unsafeBrandId(
              msg.data.eserviceTemplateVersionId
            ),
            createdAt: bigIntToDate(msg.data.createdAt).toISOString(),
            metadataVersion: msg.version,
          } satisfies z.input<
            typeof PurposeTemplateEserviceTemplateVersionSchema
          >)
        );
      })
      .with(
        { type: "PurposeTemplateEServiceTemplateUnlinked" },
        async (msg) => {
          if (!msg.data.purposeTemplate) {
            throw missingKafkaMessageDataError("purposeTemplate", msg.type);
          }
          if (!msg.data.eserviceTemplate) {
            throw missingKafkaMessageDataError("eserviceTemplate", msg.type);
          }

          deletePurposeTemplateEserviceTemplateVersionBatch.push(
            PurposeTemplateEserviceTemplateVersionDeletingSchema.parse({
              purposeTemplateId: unsafeBrandId(msg.data.purposeTemplate.id),
              eserviceTemplateId: unsafeBrandId(msg.data.eserviceTemplate.id),
              eserviceTemplateVersionId: unsafeBrandId(
                msg.data.eserviceTemplateVersionId
              ),
              deleted: true,
            } satisfies z.input<
              typeof PurposeTemplateEserviceTemplateVersionDeletingSchema
            >)
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

  if (upsertPurposeTemplateEserviceTemplateVersionBatch.length > 0) {
    await purposeTemplateService.upsertBatchPurposeTemplateEServiceTemplateVersion(
      dbContext,
      upsertPurposeTemplateEserviceTemplateVersionBatch
    );
  }

  if (deletePurposeTemplateEserviceTemplateVersionBatch.length > 0) {
    await purposeTemplateService.deleteBatchPurposeTemplateEServiceTemplateVersion(
      dbContext,
      deletePurposeTemplateEserviceTemplateVersionBatch
    );
  }
}
