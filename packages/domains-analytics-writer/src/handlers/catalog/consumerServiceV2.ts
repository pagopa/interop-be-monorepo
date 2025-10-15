/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable functional/immutable-data */
import {
  EServiceEventEnvelopeV2,
  fromEServiceV2,
  genericInternalError,
} from "pagopa-interop-models";
import { match, P } from "ts-pattern";
import { splitEserviceIntoObjectsSQL } from "pagopa-interop-readmodel";
import { z } from "zod";
import { catalogServiceBuilder } from "../../service/catalogService.js";
import { DBContext } from "../../db/db.js";
import {
  EserviceItemsSchema,
  EserviceDeletingSchema,
} from "../../model/catalog/eservice.js";
import { distinctByKeys } from "../../utils/sqlQueryHelper.js";

export async function handleCatalogMessageV2(
  messages: EServiceEventEnvelopeV2[],
  dbContext: DBContext
): Promise<void> {
  const catalogService = catalogServiceBuilder(dbContext);

  const upsertEServiceBatch: EserviceItemsSchema[] = [];
  const deleteEServiceBatch: EserviceDeletingSchema[] = [];

  for (const message of messages) {
    match(message)
      .with({ type: "EServiceDeleted" }, (msg) => {
        deleteEServiceBatch.push(
          EserviceDeletingSchema.parse({
            id: msg.data.eserviceId,
            deleted: true,
          } satisfies z.input<typeof EserviceDeletingSchema>)
        );
      })
      .with(
        {
          type: P.union(
            "EServiceAdded",
            "DraftEServiceUpdated",
            "EServiceCloned",
            "EServiceDescriptorAdded",
            "EServiceDraftDescriptorUpdated",
            "EServiceDescriptorQuotasUpdated",
            "EServiceDescriptorAgreementApprovalPolicyUpdated",
            "EServiceDescriptorActivated",
            "EServiceDescriptorArchived",
            "EServiceDescriptorPublished",
            "EServiceDescriptorSuspended",
            "EServiceDescriptorInterfaceAdded",
            "EServiceDescriptorDocumentAdded",
            "EServiceDescriptorInterfaceUpdated",
            "EServiceDescriptorDocumentUpdated",
            "EServiceRiskAnalysisAdded",
            "EServiceRiskAnalysisUpdated",
            "EServiceDescriptionUpdated",
            "EServiceDescriptorSubmittedByDelegate",
            "EServiceDescriptorApprovedByDelegator",
            "EServiceDescriptorRejectedByDelegator",
            "EServiceDescriptorAttributesUpdated",
            "EServiceNameUpdated",
            "EServiceIsConsumerDelegableEnabled",
            "EServiceIsConsumerDelegableDisabled",
            "EServiceIsClientAccessDelegableEnabled",
            "EServiceIsClientAccessDelegableDisabled",
            "EServiceNameUpdatedByTemplateUpdate",
            "EServiceDescriptionUpdatedByTemplateUpdate",
            "EServiceDescriptorDocumentUpdatedByTemplateUpdate",
            "EServiceDescriptorQuotasUpdatedByTemplateUpdate",
            "EServiceDescriptorAttributesUpdatedByTemplateUpdate",
            "EServiceDescriptorDocumentAddedByTemplateUpdate",
            "EServiceRiskAnalysisDeleted",
            "EServiceDescriptorInterfaceDeleted",
            "EServiceDescriptorDocumentDeletedByTemplateUpdate",
            "EServiceDescriptorDocumentDeleted",
            "EServiceDraftDescriptorDeleted",
            "EServiceSignalHubEnabled",
            "EServiceSignalHubDisabled",
            "EServicePersonalDataFlagUpdatedAfterPublication"
          ),
        },
        (msg) => {
          if (!msg.data.eservice) {
            throw genericInternalError(
              `EService can't be missing in the event message`
            );
          }
          const splitResult = splitEserviceIntoObjectsSQL(
            fromEServiceV2(msg.data.eservice),
            msg.version
          );

          upsertEServiceBatch.push(
            EserviceItemsSchema.parse({
              eserviceSQL: splitResult.eserviceSQL,
              riskAnalysesSQL: splitResult.riskAnalysesSQL,
              riskAnalysisAnswersSQL: splitResult.riskAnalysisAnswersSQL,
              descriptorsSQL: splitResult.descriptorsSQL,
              attributesSQL: splitResult.attributesSQL,
              interfacesSQL: splitResult.interfacesSQL,
              documentsSQL: splitResult.documentsSQL,
              rejectionReasonsSQL: splitResult.rejectionReasonsSQL,
              templateVersionRefsSQL: splitResult.templateVersionRefsSQL,
            } satisfies z.input<typeof EserviceItemsSchema>)
          );
        }
      )
      .exhaustive();
  }

  if (upsertEServiceBatch.length > 0) {
    await catalogService.upsertBatchEService(dbContext, upsertEServiceBatch);
  }
  if (deleteEServiceBatch.length > 0) {
    const distinctBatch = distinctByKeys(
      deleteEServiceBatch,
      EserviceDeletingSchema,
      ["id"]
    );
    await catalogService.deleteBatchEService(dbContext, distinctBatch);
  }
}
