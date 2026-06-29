import {
  EServiceTemplateEventEnvelopeV2,
  NewNotification,
} from "pagopa-interop-models";
import { Logger } from "pagopa-interop-commons";
import { P, match } from "ts-pattern";
import { ReadModelServiceSQL } from "../../services/readModelServiceSQL.js";
import { handleTemplateStatusChangedToProducer } from "./handleTemplateStatusChangedToProducer.js";
import { handleNewEserviceTemplateVersionToInstantiator } from "./handleNewEserviceTemplateVersionToInstantiator.js";
import { handleNewEserviceTemplateVersionToProducer } from "./handleNewEserviceTemplateVersionToProducer.js";
import { handleEserviceTemplateNameChangedToInstantiator } from "./handleEserviceTemplateNameChangedToInstantiator.js";
import { handleEserviceTemplateStatusChangedToInstantiator } from "./handleEserviceTemplateStatusChangedToInstantiator.js";

export async function handleEServiceTemplateEvent(
  decodedMessage: EServiceTemplateEventEnvelopeV2,
  logger: Logger,
  readModelService: ReadModelServiceSQL
): Promise<NewNotification[]> {
  return match(decodedMessage)
    .with(
      {
        type: "EServiceTemplateVersionSuspended",
      },
      async ({ data: { eserviceTemplate, eserviceTemplateVersionId } }) => [
        // Producer == creator of the template
        ...(await handleTemplateStatusChangedToProducer(
          eserviceTemplate,
          eserviceTemplateVersionId,
          logger,
          readModelService
        )),
        // Instantiators == tenants that have instantiated an e-service from the template
        ...(await handleEserviceTemplateStatusChangedToInstantiator(
          eserviceTemplate,
          eserviceTemplateVersionId,
          logger,
          readModelService
        )),
      ]
    )
    .with(
      {
        type: "EServiceTemplateVersionPublished",
      },
      async ({ data: { eserviceTemplate, eserviceTemplateVersionId } }) => [
        // Instantiators == tenants that have instantiated an e-service from the template
        ...(await handleNewEserviceTemplateVersionToInstantiator(
          eserviceTemplate,
          eserviceTemplateVersionId,
          logger,
          readModelService
        )),
        // Producer == creator of the template
        ...(await handleNewEserviceTemplateVersionToProducer(
          eserviceTemplate,
          eserviceTemplateVersionId,
          logger,
          readModelService
        )),
      ]
    )
    .with(
      {
        type: "EServiceTemplateNameUpdated",
      },
      ({ data: { eserviceTemplate, oldName } }) =>
        handleEserviceTemplateNameChangedToInstantiator(
          eserviceTemplate,
          oldName,
          logger,
          readModelService
        )
    )
    .with(
      {
        type: P.union(
          "EServiceTemplateAdded",
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
          "EServiceTemplateVersionInterfaceUpdated",
          "EServiceTemplateVersionDocumentUpdated",
          "EServiceTemplateIntendedTargetUpdated",
          "EServiceTemplateDescriptionUpdated",
          "EServiceTemplateVersionQuotasUpdated",
          "EServiceTemplateVersionAdded",
          "EServiceTemplateVersionAttributesUpdated",
          "EServiceTemplateVersionActivated",
          "EServiceTemplatePersonalDataFlagUpdatedAfterPublication",
          "EServiceTemplateVersionAsyncExchangeCallbackInterfaceAdded",
          "EServiceTemplateVersionAsyncExchangeCallbackInterfaceUpdated",
          "EServiceTemplateVersionAsyncExchangeCallbackInterfaceDeleted"
        ),
      },
      () => {
        logger.info(
          `Skipping in-app notification for event ${decodedMessage.type}`
        );
        return [];
      }
    )
    .exhaustive();
}
