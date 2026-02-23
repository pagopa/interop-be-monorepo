import {
  EServiceTemplateEventEnvelopeV2,
  fromEServiceTemplateV2,
  unsafeBrandId,
} from "pagopa-interop-models";
import { Logger } from "pagopa-interop-commons";
import { match, P } from "ts-pattern";
import { M2MEventWriterServiceSQL } from "../services/m2mEventWriterServiceSQL.js";
import { assertEServiceTemplateExistsInEvent } from "../services/validators.js";
import {
  createEServiceTemplateM2MEvent,
  createEServiceTemplateVersionM2MEvent,
} from "../services/event-builders/eserviceTemplateM2MEventBuilder.js";
import { toEServiceTemplateM2MEventSQL } from "../models/eserviceTemplateM2MEventAdapterSQL.js";

export async function handleEServiceTemplateEvent(
  decodedMessage: EServiceTemplateEventEnvelopeV2,
  eventTimestamp: Date,
  logger: Logger,
  m2mEventWriterService: M2MEventWriterServiceSQL
): Promise<void> {
  assertEServiceTemplateExistsInEvent(decodedMessage);
  const eserviceTemplate = fromEServiceTemplateV2(
    decodedMessage.data.eserviceTemplate
  );

  return match(decodedMessage)
    .with(
      {
        type: P.union(
          "EServiceTemplateAdded",
          "EServiceTemplateIntendedTargetUpdated",
          "EServiceTemplateDescriptionUpdated",
          "EServiceTemplateDeleted",
          "EServiceTemplateDraftUpdated",
          "EServiceTemplateNameUpdated",
          "EServiceTemplateRiskAnalysisAdded",
          "EServiceTemplateRiskAnalysisDeleted",
          "EServiceTemplateRiskAnalysisUpdated",
          "EServiceTemplatePersonalDataFlagUpdatedAfterPublication"
        ),
      },
      async (event) => {
        logger.info(
          `Creating EService Template M2M Event - type ${event.type}, eserviceTemplateId ${eserviceTemplate.id}`
        );
        const m2mEvent = await createEServiceTemplateM2MEvent(
          eserviceTemplate,
          event.version,
          event.type,
          eventTimestamp
        );

        await m2mEventWriterService.insertEServiceTemplateM2MEvent(
          toEServiceTemplateM2MEventSQL(m2mEvent)
        );
      }
    )
    .with(
      {
        type: P.union(
          "EServiceTemplateVersionActivated",
          "EServiceTemplateDraftVersionDeleted",
          "EServiceTemplateDraftVersionUpdated",
          "EServiceTemplateVersionSuspended",
          "EServiceTemplateVersionAdded",
          "EServiceTemplateVersionAttributesUpdated",
          "EServiceTemplateVersionDocumentAdded",
          "EServiceTemplateVersionDocumentDeleted",
          "EServiceTemplateVersionDocumentUpdated",
          "EServiceTemplateVersionInterfaceAdded",
          "EServiceTemplateVersionInterfaceDeleted",
          "EServiceTemplateVersionInterfaceUpdated",
          "EServiceTemplateVersionPublished",
          "EServiceTemplateVersionQuotasUpdated"
        ),
      },
      async (event) => {
        logger.info(
          `Creating EService Template M2M Event - type ${event.type}, eserviceTemplateId ${eserviceTemplate.id}, eserviceTemplateVersionId ${event.data.eserviceTemplateVersionId}`
        );
        const m2mEvent = await createEServiceTemplateVersionM2MEvent(
          eserviceTemplate,
          unsafeBrandId(event.data.eserviceTemplateVersionId),
          event.version,
          event.type,
          eventTimestamp
        );

        await m2mEventWriterService.insertEServiceTemplateM2MEvent(
          toEServiceTemplateM2MEventSQL(m2mEvent)
        );
      }
    )
    .exhaustive();
}
