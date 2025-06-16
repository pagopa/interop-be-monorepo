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
import { EserviceTemplateRiskAnalysisDeletingSchema } from "../../model/eserviceTemplate/eserviceTemplateRiskAnalysis.js";
import { EserviceTemplateVersionDeletingSchema } from "../../model/eserviceTemplate/eserviceTemplateVersion.js";
import { EserviceTemplateDocumentDeletingSchema } from "../../model/eserviceTemplate/eserviceTemplateVersionDocument.js";
import { EserviceTemplateInterfaceDeletingSchema } from "../../model/eserviceTemplate/eserviceTemplateVersionInterface.js";
import { distinctByKeys } from "../../utils/sqlQueryHelper.js";

export async function handleEserviceTemplateMessageV2(
  messages: EServiceTemplateEventEnvelope[],
  dbContext: DBContext
): Promise<void> {
  const templateService = eserviceTemplateServiceBuilder(dbContext);

  const upsertEserviceTemplateBatch: EserviceTemplateItemsSchema[] = [];
  const deleteEserviceTemplateBatch: EserviceTemplateDeletingSchema[] = [];
  const deleteEserviceTemplateVersionBatch: EserviceTemplateVersionDeletingSchema[] =
    [];
  const deleteEserviceTemplateInterfaceBatch: EserviceTemplateInterfaceDeletingSchema[] =
    [];
  const deleteEserviceTemplateDocumentBatch: EserviceTemplateDocumentDeletingSchema[] =
    [];
  const deleteEserviceTemplateRiskAnalysisBatch: EserviceTemplateRiskAnalysisDeletingSchema[] =
    [];

  for (const message of messages) {
    match(message)
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
            throw genericInternalError(
              "eserviceTemplate can't be missing in the event message"
            );
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
          throw genericInternalError(
            "eserviceTemplate can't be missing in the event message"
          );
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
          EserviceTemplateVersionDeletingSchema.parse({
            id: msg.data.eserviceTemplateVersionId,
            deleted: true,
          } satisfies z.input<typeof EserviceTemplateVersionDeletingSchema>)
        );
      })
      .with({ type: "EServiceTemplateVersionInterfaceDeleted" }, (msg) => {
        const { eserviceTemplate, eserviceTemplateVersionId } = msg.data;

        if (!eserviceTemplate) {
          throw genericInternalError(
            "eserviceTemplate can't be missing in the event message"
          );
        }

        const version = eserviceTemplate.versions.find(
          (v) => v.id === eserviceTemplateVersionId
        );
        if (!version) {
          throw genericInternalError(
            `Version not found for versionId: ${eserviceTemplateVersionId}`
          );
        }

        if (!version.interface) {
          throw genericInternalError(
            `Missing interface for the specified version id: ${version.id}`
          );
        }

        deleteEserviceTemplateInterfaceBatch.push(
          EserviceTemplateInterfaceDeletingSchema.parse({
            id: version.interface.id,
            deleted: true,
          } satisfies z.input<typeof EserviceTemplateInterfaceDeletingSchema>)
        );
      })
      .with({ type: "EServiceTemplateVersionDocumentDeleted" }, (msg) => {
        deleteEserviceTemplateDocumentBatch.push(
          EserviceTemplateDocumentDeletingSchema.parse({
            id: msg.data.documentId,
            deleted: true,
          } satisfies z.input<typeof EserviceTemplateDocumentDeletingSchema>)
        );
      })
      .with({ type: "EServiceTemplateRiskAnalysisDeleted" }, (msg) => {
        deleteEserviceTemplateRiskAnalysisBatch.push(
          EserviceTemplateRiskAnalysisDeletingSchema.parse({
            id: msg.data.riskAnalysisId,
            deleted: true,
          } satisfies z.input<typeof EserviceTemplateRiskAnalysisDeletingSchema>)
        );
      })
      .exhaustive();
  }

  if (upsertEserviceTemplateBatch.length > 0) {
    await templateService.upsertBatchEserviceTemplate(
      dbContext,
      upsertEserviceTemplateBatch
    );
  }

  if (deleteEserviceTemplateBatch.length > 0) {
    const distinctBatch = distinctByKeys(
      deleteEserviceTemplateBatch,
      EserviceTemplateDeletingSchema,
      ["id"]
    );
    await templateService.deleteBatchEserviceTemplate(dbContext, distinctBatch);
  }

  if (deleteEserviceTemplateVersionBatch.length > 0) {
    const distinctBatch = distinctByKeys(
      deleteEserviceTemplateVersionBatch,
      EserviceTemplateVersionDeletingSchema,
      ["id"]
    );
    await templateService.deleteBatchEserviceTemplateVersion(
      dbContext,
      distinctBatch
    );
  }

  if (deleteEserviceTemplateInterfaceBatch.length > 0) {
    const distinctBatch = distinctByKeys(
      deleteEserviceTemplateInterfaceBatch,
      EserviceTemplateInterfaceDeletingSchema,
      ["id"]
    );
    await templateService.deleteBatchEserviceTemplateInterface(
      dbContext,
      distinctBatch
    );
  }

  if (deleteEserviceTemplateDocumentBatch.length > 0) {
    const distinctBatch = distinctByKeys(
      deleteEserviceTemplateDocumentBatch,
      EserviceTemplateDocumentDeletingSchema,
      ["id"]
    );
    await templateService.deleteBatchEserviceTemplateDocument(
      dbContext,
      distinctBatch
    );
  }

  if (deleteEserviceTemplateRiskAnalysisBatch.length > 0) {
    const distinctBatch = distinctByKeys(
      deleteEserviceTemplateRiskAnalysisBatch,
      EserviceTemplateRiskAnalysisDeletingSchema,
      ["id"]
    );
    await templateService.deleteBatchEserviceTemplateRiskAnalysis(
      dbContext,
      distinctBatch
    );
  }
}
