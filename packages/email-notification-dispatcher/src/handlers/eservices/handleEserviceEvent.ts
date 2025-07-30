import { HtmlTemplateService, Logger } from "pagopa-interop-commons";
import {
  CorrelationId,
  EmailNotificationMessagePayload,
  EServiceEventEnvelopeV2,
} from "pagopa-interop-models";
import { match, P } from "ts-pattern";
import { ReadModelServiceSQL } from "../../services/readModelServiceSQL.js";
import { config } from "../../config/config.js";
import { handleEserviceDescriptorPublished } from "./handleEServiceDescriptorPublished.js";

const interopFeBaseUrl = config.interopFeBaseUrl;

export async function handleEServiceEvent(
  decodedMessage: EServiceEventEnvelopeV2,
  correlationId: CorrelationId,
  logger: Logger,
  readModelService: ReadModelServiceSQL,
  templateService: HtmlTemplateService
): Promise<EmailNotificationMessagePayload[]> {
  return match(decodedMessage)
    .with({ type: "EServiceDescriptorPublished" }, ({ data: { eservice } }) =>
      handleEserviceDescriptorPublished({
        eserviceV2Msg: eservice,
        interopFeBaseUrl,
        logger,
        readModelService,
        templateService,
        correlationId,
      })
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
      () => {
        logger.info(
          `No need to send an email-app notification for ${decodedMessage.type} message`
        );
        return [];
      }
    )
    .exhaustive();
}
