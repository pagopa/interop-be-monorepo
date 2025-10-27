import {
  NewNotification,
  DescriptorId,
  EServiceEventEnvelopeV2,
  unsafeBrandId,
} from "pagopa-interop-models";
import { Logger } from "pagopa-interop-commons";
import { P, match } from "ts-pattern";
import { ReadModelServiceSQL } from "../../services/readModelServiceSQL.js";
import { handleEserviceStateChangedToConsumer } from "./handleEserviceStateChangedToConsumer.js";
import { handleEserviceNewVersionApprovedRejectedToDelegate } from "./handleEserviceNewVersionApprovedRejectedToDelegate.js";
import { handleEserviceNewVersionSubmittedToDelegator } from "./handleEserviceNewVersionSubmittedToDelegator.js";

export async function handleEServiceEvent(
  decodedMessage: EServiceEventEnvelopeV2,
  logger: Logger,
  readModelService: ReadModelServiceSQL
): Promise<NewNotification[]> {
  return match(decodedMessage)
    .with(
      {
        type: P.union(
          "EServiceNameUpdated",
          "EServiceDescriptionUpdated",
          "EServiceDescriptorPublished",
          "EServiceDescriptorSuspended",
          "EServiceDescriptorActivated",
          "EServiceDescriptorQuotasUpdated",
          "EServiceDescriptorAttributesUpdated",
          "EServiceDescriptorDocumentAdded",
          "EServiceDescriptorDocumentUpdated",
          "EServiceNameUpdatedByTemplateUpdate",
          "EServiceDescriptionUpdatedByTemplateUpdate",
          "EServiceDescriptorAttributesUpdatedByTemplateUpdate",
          "EServiceDescriptorQuotasUpdatedByTemplateUpdate",
          "EServiceDescriptorDocumentAddedByTemplateUpdate",
          "EServiceDescriptorDocumentUpdatedByTemplateUpdate"
        ),
      },
      (msg) =>
        handleEserviceStateChangedToConsumer(msg, logger, readModelService)
    )
    .with(
      { type: "EServiceDescriptorSubmittedByDelegate" },
      ({ data: { eservice, descriptorId } }) =>
        handleEserviceNewVersionSubmittedToDelegator(
          eservice,
          unsafeBrandId<DescriptorId>(descriptorId),
          logger,
          readModelService
        )
    )
    .with(
      {
        type: P.union(
          "EServiceDescriptorApprovedByDelegator",
          "EServiceDescriptorRejectedByDelegator"
        ),
      },
      ({ data: { eservice, descriptorId }, type }) =>
        handleEserviceNewVersionApprovedRejectedToDelegate(
          eservice,
          unsafeBrandId<DescriptorId>(descriptorId),
          logger,
          readModelService,
          type
        )
    )
    .with(
      {
        type: P.union(
          "EServiceDescriptorArchived",
          "EServiceAdded",
          "EServiceCloned",
          "EServiceDeleted",
          "DraftEServiceUpdated",
          "EServiceDescriptorAdded",
          "EServiceDraftDescriptorDeleted",
          "EServiceDraftDescriptorUpdated",
          "EServiceDescriptorInterfaceDeleted",
          "EServiceRiskAnalysisAdded",
          "EServiceRiskAnalysisUpdated",
          "EServiceRiskAnalysisDeleted",
          "EServiceIsConsumerDelegableEnabled",
          "EServiceIsConsumerDelegableDisabled",
          "EServiceIsClientAccessDelegableEnabled",
          "EServiceIsClientAccessDelegableDisabled",
          "EServiceSignalHubEnabled",
          "EServiceSignalHubDisabled",
          "EServiceDescriptorInterfaceAdded",
          "EServicePersonalDataFlagUpdatedAfterPublication",
          "EServiceDescriptorAgreementApprovalPolicyUpdated",
          "EServiceDescriptorInterfaceUpdated",
          "EServiceDescriptorDocumentDeletedByTemplateUpdate",
          "EServiceDescriptorDocumentDeleted",
        ),
      },
      () => {
        logger.info(
          `No need to send an in-app notification for ${decodedMessage.type} message`
        );
        return [];
      }
    )
    .exhaustive();
}
