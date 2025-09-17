import {
  EServiceEventEnvelopeV2,
  m2mEventVisibility,
} from "pagopa-interop-models";
import { Logger } from "pagopa-interop-commons";
import { P, match } from "ts-pattern";
import { ReadModelServiceSQL } from "../services/readModelServiceSQL.js";
import { M2MEventWriterServiceSQL } from "../services/m2mEventWriterServiceSQL.js";
import {
  toNewEServiceDescriptorM2MEventSQL,
  toNewEServiceM2MEventSQL,
} from "../models/eserviceM2MEventAdapterSQL.js";
import { assertEServiceExistsInEvent } from "./validators.js";

export async function handleEServiceEvent(
  decodedMessage: EServiceEventEnvelopeV2,
  eventTimestamp: Date,
  logger: Logger,
  m2mEventWriterService: M2MEventWriterServiceSQL,
  readModelService: ReadModelServiceSQL
): Promise<void> {
  return match(decodedMessage)
    .with(
      {
        type: P.union("DraftEServiceUpdated"),
      },
      async (event) => {
        assertEServiceExistsInEvent(event);
        const m2mEvent = toNewEServiceM2MEventSQL(event, eventTimestamp, {
          visibility: m2mEventVisibility.restricted,
          producerDelegation:
            await readModelService.getActiveProducerDelegationForEService(
              event.data.eservice
            ),
        });
        logger.info(
          `Writing EService Descriptor M2M Event with ID ${m2mEvent.id}, type ${m2mEvent.eventType}, eserviceId ${m2mEvent.eserviceId}`
        );

        await m2mEventWriterService.insertEServiceM2MEvent(m2mEvent);
      }
    )
    .with(
      {
        type: P.union("EServiceDescriptorPublished"),
      },
      async (event) => {
        assertEServiceExistsInEvent(event);
        const m2mEvent = toNewEServiceDescriptorM2MEventSQL(
          event,
          eventTimestamp,
          { visibility: m2mEventVisibility.public }
        );
        logger.info(
          `Writing EService Descriptor M2M Event with ID ${m2mEvent.id}, type ${m2mEvent.eventType}, eserviceId ${m2mEvent.eserviceId}`
        );

        await m2mEventWriterService.insertEServiceM2MEvent(m2mEvent);
      }
    )
    .with(
      {
        type: P.union(
          "EServiceDescriptorActivated",
          "EServiceDescriptorApprovedByDelegator",
          "EServiceDescriptorSuspended",
          "EServiceDescriptorArchived",
          "EServiceDescriptorQuotasUpdated",
          "EServiceDescriptorAgreementApprovalPolicyUpdated",
          "EServiceAdded",
          "EServiceCloned",
          "EServiceDeleted",
          "EServiceDescriptorAdded",
          "EServiceDraftDescriptorDeleted",
          "EServiceDraftDescriptorUpdated",
          "EServiceDescriptorDocumentAdded",
          "EServiceDescriptorDocumentUpdated",
          "EServiceDescriptorDocumentDeleted",
          "EServiceDescriptorInterfaceAdded",
          "EServiceDescriptorInterfaceUpdated",
          "EServiceDescriptorInterfaceDeleted",
          "EServiceRiskAnalysisAdded",
          "EServiceRiskAnalysisUpdated",
          "EServiceRiskAnalysisDeleted",
          "EServiceDescriptorAttributesUpdated",
          "EServiceDescriptionUpdated",
          "EServiceNameUpdated",
          "EServiceDescriptorSubmittedByDelegate",
          "EServiceDescriptorRejectedByDelegator",
          "EServiceIsConsumerDelegableEnabled",
          "EServiceIsConsumerDelegableDisabled",
          "EServiceIsClientAccessDelegableEnabled",
          "EServiceIsClientAccessDelegableDisabled",
          "EServiceNameUpdatedByTemplateUpdate",
          "EServiceDescriptionUpdatedByTemplateUpdate",
          "EServiceDescriptorAttributesUpdatedByTemplateUpdate",
          "EServiceDescriptorQuotasUpdatedByTemplateUpdate",
          "EServiceDescriptorDocumentAddedByTemplateUpdate",
          "EServiceDescriptorDocumentDeletedByTemplateUpdate",
          "EServiceDescriptorDocumentUpdatedByTemplateUpdate",
          "EServiceSignalHubEnabled",
          "EServiceSignalHubDisabled"
        ),
      },
      () => Promise.resolve(void 0)
    )
    .exhaustive();
}
