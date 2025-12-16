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
import { distinctByKeys } from "../../utils/sqlQueryHelper.js";

export async function handleEserviceTemplateMessageV2(
  messages: EServiceTemplateEventEnvelope[],
  dbContext: DBContext
): Promise<void> {
  const templateService = eserviceTemplateServiceBuilder(dbContext);

  const upsertEserviceTemplateBatch: EserviceTemplateItemsSchema[] = [];
  const deleteEserviceTemplateBatch: EserviceTemplateDeletingSchema[] = [];

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
            "EServiceTemplateVersionActivated",
            "EServiceTemplateDraftVersionDeleted",
            "EServiceTemplateVersionInterfaceDeleted",
            "EServiceTemplateVersionDocumentDeleted",
            "EServiceTemplateRiskAnalysisDeleted",
            "EServiceTemplatePersonalDataFlagUpdatedAfterPublication"
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
}
