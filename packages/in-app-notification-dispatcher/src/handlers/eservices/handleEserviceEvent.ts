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
    .with({ type: "EServiceDescriptorPublished" }, ({ data: { eservice } }) =>
      handleEserviceStateChangedToConsumer(eservice, logger, readModelService)
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
          "EServiceDescriptorActivated",
          "EServiceDescriptorSuspended",
          "EServiceDescriptorArchived",
          "EServiceDescriptorQuotasUpdated",
          "EServiceDescriptorAgreementApprovalPolicyUpdated",
          "EServiceAdded",
          "EServiceCloned",
          "EServiceDeleted",
          "DraftEServiceUpdated",
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
      () => {
        logger.info(
          `No need to send an in-app notification for ${decodedMessage.type} message`
        );
        return [];
      }
    )
    .exhaustive();
}
