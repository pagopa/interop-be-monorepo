import {
  EServiceEventEnvelopeV2,
  fromEServiceV2,
  m2mEventVisibility,
  unsafeBrandId,
} from "pagopa-interop-models";
import { Logger } from "pagopa-interop-commons";
import { P, match } from "ts-pattern";
import { ReadModelServiceSQL } from "../services/readModelServiceSQL.js";
import { M2MEventWriterServiceSQL } from "../services/m2mEventWriterServiceSQL.js";
import {
  createEServiceDescriptorM2MEvent,
  createEServiceM2MEvent,
} from "../models/eserviceM2MEventBuilder.js";
import { toEServiceM2MEventSQL } from "../models/eserviceM2MEventAdapterSQL.js";
import { assertEServiceExistsInEvent } from "./validators.js";

export async function handleEServiceEvent(
  decodedMessage: EServiceEventEnvelopeV2,
  eventTimestamp: Date,
  logger: Logger,
  m2mEventWriterService: M2MEventWriterServiceSQL,
  readModelService: ReadModelServiceSQL
): Promise<void> {
  assertEServiceExistsInEvent(decodedMessage);
  const eservice = fromEServiceV2(decodedMessage.data.eservice);

  return match(decodedMessage)
    .with(
      {
        type: P.union("DraftEServiceUpdated"),
      },
      async (event) => {
        logger.info(
          `Creating EService M2M Event - type ${event.type}, eserviceId ${eservice.id}`
        );
        const m2mEvent = createEServiceM2MEvent(
          eservice,
          event.type,
          eventTimestamp,
          {
            visibility: m2mEventVisibility.restricted,
            producerDelegation:
              await readModelService.getActiveProducerDelegationForEService(
                event.data.eservice
              ),
          }
        );

        await m2mEventWriterService.insertEServiceM2MEvent(
          toEServiceM2MEventSQL(m2mEvent)
        );
      }
    )
    .with(
      {
        type: P.union("EServiceDescriptorPublished"),
      },
      async (event) => {
        logger.info(
          `Creating EService M2M Event - type ${event.type}, eserviceId ${eservice.id}, descriptorId ${event.data.descriptorId}`
        );
        const m2mEvent = createEServiceDescriptorM2MEvent(
          eservice,
          unsafeBrandId(event.data.descriptorId),
          event.type,
          eventTimestamp,
          { visibility: m2mEventVisibility.public }
        );

        await m2mEventWriterService.insertEServiceM2MEvent(
          toEServiceM2MEventSQL(m2mEvent)
        );
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
