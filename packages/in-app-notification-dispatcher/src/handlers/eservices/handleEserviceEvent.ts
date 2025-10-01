import {
  NewNotification,
  DescriptorId,
  EServiceEventEnvelopeV2,
  unsafeBrandId,
} from "pagopa-interop-models";
import { Logger } from "pagopa-interop-commons";
import { P, match } from "ts-pattern";
import { ReadModelServiceSQL } from "../../services/readModelServiceSQL.js";
import { UserServiceSQL } from "../../services/userServiceSQL.js";
import { handleEserviceStateChangedToConsumer } from "./handleEserviceStateChangedToConsumer.js";
import { handleEserviceNewVersionApprovedRejectedToDelegate } from "./handleEserviceNewVersionApprovedRejectedToDelegate.js";
import { handleEserviceNewVersionSubmittedToDelegator } from "./handleEserviceNewVersionSubmittedToDelegator.js";

export async function handleEServiceEvent(
  decodedMessage: EServiceEventEnvelopeV2,
  logger: Logger,
  readModelService: ReadModelServiceSQL,
  userService: UserServiceSQL
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
          "EServiceDescriptorAgreementApprovalPolicyUpdated",
          "EServiceDescriptorInterfaceAdded",
          "EServiceDescriptorDocumentAdded",
          "EServiceDescriptorDocumentDeleted",
          "EServiceDescriptorInterfaceUpdated",
          "EServiceDescriptorDocumentUpdated",
          "EServiceNameUpdatedByTemplateUpdate",
          "EServiceDescriptionUpdatedByTemplateUpdate",
          "EServiceDescriptorAttributesUpdatedByTemplateUpdate",
          "EServiceDescriptorQuotasUpdatedByTemplateUpdate",
          "EServiceDescriptorDocumentAddedByTemplateUpdate",
          "EServiceDescriptorDocumentDeletedByTemplateUpdate",
          "EServiceDescriptorDocumentUpdatedByTemplateUpdate"
        ),
      },
      (msg) =>
        handleEserviceStateChangedToConsumer(
          msg,
          logger,
          readModelService,
          userService
        )
    )
    .with(
      { type: "EServiceDescriptorSubmittedByDelegate" },
      ({ data: { eservice, descriptorId } }) =>
        handleEserviceNewVersionSubmittedToDelegator(
          eservice,
          unsafeBrandId<DescriptorId>(descriptorId),
          logger,
          readModelService,
          userService
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
          userService,
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
