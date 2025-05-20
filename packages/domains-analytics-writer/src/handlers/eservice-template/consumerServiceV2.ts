/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable functional/immutable-data */
/* eslint-disable sonarjs/cognitive-complexity */
import {
  EServiceTemplateEventEnvelope,
  fromEServiceTemplateV2,
  genericInternalError,
} from "pagopa-interop-models";
import { match, P } from "ts-pattern";
import { z } from "zod";
import { splitEServiceTemplateIntoObjectsSQL } from "pagopa-interop-readmodel";
import { DBContext } from "../../db/db.js";
import {
  EserviceTemplateItemsSchema,
  EserviceTemplateDeletingSchema,
} from "../../model/eserviceTemplate/eserviceTemplate.js";
import { eserviceTemplateServiceBuilder } from "../../service/eserviceTemplateService.js";

export async function handleEserviceTemplateMessageV2(
  messages: EServiceTemplateEventEnvelope[],
  dbContext: DBContext
): Promise<void> {
  const templateService = eserviceTemplateServiceBuilder(dbContext);

  const upsertEserviceTemplateBatch: EserviceTemplateItemsSchema[] = [];
  const deleteEserviceTemplateBatch: EserviceTemplateDeletingSchema[] = [];
  const deleteEserviceTemplateVersionBatch: EserviceTemplateDeletingSchema[] =
    [];
  const deleteEserviceTemplateInterfaceBatch: EserviceTemplateDeletingSchema[] =
    [];
  const deleteEserviceTemplateDocumentBatch: EserviceTemplateDeletingSchema[] =
    [];
  const deleteEserviceTemplateRiskAnalysisBatch: EserviceTemplateDeletingSchema[] =
    [];

  for (const msg of messages) {
    match(msg)
      .with(
        {
          type: P.union(
            "EServiceTemplateAdded",
            "EServiceTemplateVersionAdded",
            "EServiceTemplateIntendedTargetUpdated",
            "EServiceTemplateDescriptionUpdated",
            "EServiceTemplateDraftUpdated",
            "EServiceTemplateDraftVersionUpdated",
            "EServiceTemplateNameUpdated",
            "EServiceTemplateVersionPublished",
            "EServiceTemplateVersionSuspended",
            "EServiceTemplateVersionQuotasUpdated",
            "EServiceTemplateVersionAttributesUpdated",
            "EServiceTemplateVersionDocumentAdded",
            "EServiceTemplateVersionDocumentUpdated",
            "EServiceTemplateVersionInterfaceAdded",
            "EServiceTemplateVersionInterfaceUpdated",
            "EServiceTemplateRiskAnalysisAdded",
            "EServiceTemplateRiskAnalysisUpdated",
            "EServiceTemplateVersionActivated"
          ),
        },
        (msg) => {
          if (!msg.data.eserviceTemplate) {
            throw genericInternalError("Missing `eserviceTemplate` in event");
          }
          const splitResult = splitEServiceTemplateIntoObjectsSQL(
            fromEServiceTemplateV2(msg.data.eserviceTemplate),
            msg.version
          );

          upsertEserviceTemplateBatch.push(
            EserviceTemplateItemsSchema.parse({
              eserviceTemplateSQL: splitResult.eserviceTemplateSQL,
              versionsSQL: splitResult.versionsSQL,
              interfacesSQL: splitResult.interfacesSQL,
              documentsSQL: splitResult.documentsSQL,
              attributesSQL: splitResult.attributesSQL,
              riskAnalysesSQL: splitResult.riskAnalysesSQL,
              riskAnalysisAnswersSQL: splitResult.riskAnalysisAnswersSQL,
            } satisfies z.input<typeof EserviceTemplateItemsSchema>)
          );
        }
      )
      .with({ type: "EServiceTemplateDeleted" }, (msg) => {
        if (!msg.data.eserviceTemplate) {
          throw genericInternalError("Missing `eserviceTemplate` in event");
        }
        deleteEserviceTemplateBatch.push(
          EserviceTemplateDeletingSchema.parse({
            id: msg.data.eserviceTemplate.id,
            deleted: true,
          } satisfies z.input<typeof EserviceTemplateDeletingSchema>)
        );
      })
      .with({ type: "EServiceTemplateDraftVersionDeleted" }, (msg) => {
        deleteEserviceTemplateVersionBatch.push(
          EserviceTemplateDeletingSchema.parse({
            id: msg.data.eserviceTemplateVersionId,
            deleted: true,
          } satisfies z.input<typeof EserviceTemplateDeletingSchema>)
        );
      })
      .with({ type: "EServiceTemplateVersionInterfaceDeleted" }, (msg) => {
        if (!msg.data.eserviceTemplate) {
          throw genericInternalError("Missing `eserviceTemplate` in event");
        }

        const version = msg.data.eserviceTemplate.versions.find(
          (v) => v.id === msg.data.eserviceTemplateVersionId
        );

        const versionInterfaceId = version?.interface?.id;
        if (!versionInterfaceId) {
          throw genericInternalError(
            "Missing `interface.id` for the specified version"
          );
        }
        deleteEserviceTemplateInterfaceBatch.push(
          EserviceTemplateDeletingSchema.parse({
            id: versionInterfaceId,
            deleted: true,
          } satisfies z.input<typeof EserviceTemplateDeletingSchema>)
        );
      })
      .with({ type: "EServiceTemplateVersionDocumentDeleted" }, (msg) => {
        deleteEserviceTemplateDocumentBatch.push(
          EserviceTemplateDeletingSchema.parse({
            id: msg.data.documentId,
            deleted: true,
          } satisfies z.input<typeof EserviceTemplateDeletingSchema>)
        );
      })
      .with({ type: "EServiceTemplateRiskAnalysisDeleted" }, (msg) => {
        deleteEserviceTemplateRiskAnalysisBatch.push(
          EserviceTemplateDeletingSchema.parse({
            id: msg.data.riskAnalysisId,
            deleted: true,
          } satisfies z.input<typeof EserviceTemplateDeletingSchema>)
        );
      })
      .exhaustive();
  }

  if (upsertEserviceTemplateBatch.length) {
    await templateService.upsertBatchEserviceTemplate(
      dbContext,
      upsertEserviceTemplateBatch
    );
  }
  if (deleteEserviceTemplateBatch.length) {
    await templateService.deleteBatchEserviceTemplate(
      dbContext,
      deleteEserviceTemplateBatch
    );
  }
  if (deleteEserviceTemplateVersionBatch.length) {
    await templateService.deleteBatchEserviceTemplateVersion(
      dbContext,
      deleteEserviceTemplateVersionBatch
    );
  }
  if (deleteEserviceTemplateInterfaceBatch.length) {
    await templateService.deleteBatchEserviceTemplateInterface(
      dbContext,
      deleteEserviceTemplateInterfaceBatch
    );
  }
  if (deleteEserviceTemplateDocumentBatch.length) {
    await templateService.deleteBatchEserviceTemplateDocument(
      dbContext,
      deleteEserviceTemplateDocumentBatch
    );
  }
  if (deleteEserviceTemplateRiskAnalysisBatch.length) {
    await templateService.deleteBatchEserviceTemplateRiskAnalysis(
      dbContext,
      deleteEserviceTemplateRiskAnalysisBatch
    );
  }
}
