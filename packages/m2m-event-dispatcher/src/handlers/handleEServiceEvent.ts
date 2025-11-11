import {
  EServiceEventEnvelopeV2,
  fromEServiceV2,
  unsafeBrandId,
} from "pagopa-interop-models";
import { Logger } from "pagopa-interop-commons";
import { P, match } from "ts-pattern";
import { ReadModelServiceSQL } from "../services/readModelServiceSQL.js";
import { M2MEventWriterServiceSQL } from "../services/m2mEventWriterServiceSQL.js";
import {
  createEServiceDescriptorM2MEvent,
  createEServiceM2MEvent,
} from "../services/event-builders/eserviceM2MEventBuilder.js";
import { toEServiceM2MEventSQL } from "../models/eserviceM2MEventAdapterSQL.js";
import { assertEServiceExistsInEvent } from "../services/validators.js";

export async function handleEServiceEvent(
  decodedMessage: EServiceEventEnvelopeV2,
  eventTimestamp: Date,
  logger: Logger,
  m2mEventWriterService: M2MEventWriterServiceSQL,
  readModelService: ReadModelServiceSQL
): Promise<void> {
  assertEServiceExistsInEvent(decodedMessage);
  const eservice = fromEServiceV2(decodedMessage.data.eservice);

  return (
    match(decodedMessage)
      /**
       * Handling events related to the main E-Service resource (no descriptorId).
       */
      .with(
        {
          type: P.union(
            "EServiceAdded",
            "DraftEServiceUpdated",
            "EServiceCloned",
            "EServiceDeleted",
            "EServiceNameUpdated",
            "EServiceDescriptionUpdated",
            "EServiceIsConsumerDelegableEnabled",
            "EServiceIsConsumerDelegableDisabled",
            "EServiceIsClientAccessDelegableEnabled",
            "EServiceIsClientAccessDelegableDisabled",
            "EServiceNameUpdatedByTemplateUpdate",
            "EServiceDescriptionUpdatedByTemplateUpdate",
            "EServiceSignalHubEnabled",
            "EServiceSignalHubDisabled",
            "EServiceRiskAnalysisAdded",
            "EServiceRiskAnalysisUpdated",
            "EServiceRiskAnalysisDeleted",
            "EServicePersonalDataFlagUpdatedAfterPublication",
            "EServicePersonalDataFlagUpdatedByTemplateUpdate"
          ),
        },
        async (event) => {
          logger.info(
            `Creating EService M2M Event - type ${event.type}, eserviceId ${eservice.id}`
          );
          const m2mEvent = await createEServiceM2MEvent(
            eservice,
            event.version,
            event.type,
            eventTimestamp,
            await readModelService.getActiveProducerDelegationForEService(
              eservice
            )
          );

          await m2mEventWriterService.insertEServiceM2MEvent(
            toEServiceM2MEventSQL(m2mEvent)
          );
        }
      )
      /**
       * Handling events related to the EService Descriptors (with descriptorId).
       */
      .with(
        {
          type: P.union(
            "EServiceDescriptorPublished",
            "EServiceDescriptorActivated",
            "EServiceDescriptorApprovedByDelegator",
            "EServiceDescriptorSuspended",
            "EServiceDescriptorArchived",
            "EServiceDescriptorQuotasUpdated",
            "EServiceDescriptorAgreementApprovalPolicyUpdated",
            "EServiceDescriptorAdded",
            "EServiceDraftDescriptorDeleted",
            "EServiceDraftDescriptorUpdated",
            "EServiceDescriptorAttributesUpdated",
            "EServiceDescriptorSubmittedByDelegate",
            "EServiceDescriptorRejectedByDelegator",
            "EServiceDescriptorAttributesUpdatedByTemplateUpdate",
            "EServiceDescriptorQuotasUpdatedByTemplateUpdate",
            "EServiceDescriptorDocumentAdded",
            "EServiceDescriptorDocumentUpdated",
            "EServiceDescriptorDocumentDeleted",
            "EServiceDescriptorDocumentAddedByTemplateUpdate",
            "EServiceDescriptorDocumentDeletedByTemplateUpdate",
            "EServiceDescriptorDocumentUpdatedByTemplateUpdate",
            "EServiceDescriptorInterfaceAdded",
            "EServiceDescriptorInterfaceUpdated",
            "EServiceDescriptorInterfaceDeleted"
          ),
        },
        async (event) => {
          logger.info(
            `Creating EService M2M Event - type ${event.type}, eserviceId ${eservice.id}, descriptorId ${event.data.descriptorId}`
          );
          const m2mEvent = await createEServiceDescriptorM2MEvent(
            eservice,
            unsafeBrandId(event.data.descriptorId),
            event.version,
            event.type,
            eventTimestamp,
            await readModelService.getActiveProducerDelegationForEService(
              eservice
            )
          );

          await m2mEventWriterService.insertEServiceM2MEvent(
            toEServiceM2MEventSQL(m2mEvent)
          );
        }
      )
      .exhaustive()
  );
}
