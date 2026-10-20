import {
  EmailNotificationMessagePayload,
  EServiceTemplateEventV2,
  EServiceTemplateVersionId,
  unsafeBrandId,
} from "pagopa-interop-models";
import { match, P } from "ts-pattern";

import { HandlerParams } from "../../models/handlerParams.js";
import { handleEServiceTemplateVersionPublished } from "./handleEserviceTemplateVersionPublished.js";
import { handleEServiceTemplateVersionSuspendedToCreator } from "./handleEserviceTemplateVersionSuspendedToCreator.js";
import { handleEServiceTemplateVersionSuspendedToInstantiator } from "./handleEserviceTemplateVersionSuspendedToInstantiator.js";

export async function handleEServiceTemplateEvent(
  params: HandlerParams<typeof EServiceTemplateEventV2>
): Promise<EmailNotificationMessagePayload[]> {
  const {
    decodedMessage,
    logger,
    readModelService,
    templateService,
    correlationId,
  } = params;
  return match(decodedMessage)
    .with(
      { type: "EServiceTemplateVersionSuspended" },
      async ({ data: { eserviceTemplate, eserviceTemplateVersionId } }) => [
        ...(await handleEServiceTemplateVersionSuspendedToCreator({
          eserviceTemplateV2Msg: eserviceTemplate,
          eserviceTemplateVersionId: unsafeBrandId<EServiceTemplateVersionId>(
            eserviceTemplateVersionId
          ),
          logger,
          readModelService,
          templateService,
          correlationId,
        })),
        ...(await handleEServiceTemplateVersionSuspendedToInstantiator({
          eserviceTemplateV2Msg: eserviceTemplate,
          eserviceTemplateVersionId: unsafeBrandId<EServiceTemplateVersionId>(
            eserviceTemplateVersionId
          ),
          logger,
          readModelService,
          templateService,
          correlationId,
        })),
      ]
    )
    .with(
      { type: "EServiceTemplateVersionPublished" },
      async ({ data: { eserviceTemplate, eserviceTemplateVersionId } }) =>
        handleEServiceTemplateVersionPublished({
          eserviceTemplateV2Msg: eserviceTemplate,
          eserviceTemplateVersionId: unsafeBrandId<EServiceTemplateVersionId>(
            eserviceTemplateVersionId
          ),
          logger,
          readModelService,
          templateService,
          correlationId,
        })
    )
    .with(
      {
        type: P.union(
          "EServiceTemplateAdded",
          /**
           * The instantiators are notified of the rename on the eservice event
           * `EServiceNameUpdatedByTemplateUpdate`, which carries the actual old
           * and new names of each instance.
           */
          "EServiceTemplateNameUpdated",
          "EServiceTemplateRiskAnalysisAdded",
          "EServiceTemplateRiskAnalysisDeleted",
          "EServiceTemplateRiskAnalysisUpdated",
          "MaintenanceEServiceTemplateRiskAnalysisSetTenantKind",
          "EServiceTemplateDraftVersionUpdated",
          "EServiceTemplateDraftUpdated",
          "EServiceTemplateDraftVersionDeleted",
          "EServiceTemplateDeleted",
          "EServiceTemplateVersionInterfaceAdded",
          "EServiceTemplateVersionDocumentAdded",
          "EServiceTemplateVersionInterfaceDeleted",
          "EServiceTemplateVersionDocumentDeleted",
          "EServiceTemplateVersionDocumentUpdated",
          "EServiceTemplateIntendedTargetUpdated",
          "EServiceTemplateDescriptionUpdated",
          "EServiceTemplateVersionQuotasUpdated",
          "EServiceTemplateVersionAdded",
          "EServiceTemplateVersionAttributesUpdated",
          "EServiceTemplateVersionActivated",
          "EServiceTemplatePersonalDataFlagUpdatedAfterPublication",
          "EServiceTemplateVersionAsyncExchangeCallbackInterfaceAdded",
          "EServiceTemplateVersionAsyncExchangeCallbackInterfaceDeleted"
        ),
      },
      () => {
        logger.info(
          `Skipping email notification for event ${decodedMessage.type}`
        );
        return [];
      }
    )
    .exhaustive();
}
