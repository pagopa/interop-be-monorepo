import {
  EServiceV2,
  fromEServiceV2,
  missingKafkaMessageDataError,
  NewNotification,
} from "pagopa-interop-models";
import { Logger } from "pagopa-interop-commons";
import { match } from "ts-pattern";
import { ReadModelServiceSQL } from "../../services/readModelServiceSQL.js";
import { inAppTemplates } from "../../templates/inAppTemplates.js";
import {
  retrieveLatestPublishedDescriptor,
  retrieveTenant,
} from "../handlerCommons.js";

type EServiceStateChangedEventType =
  | "EServiceDescriptorPublished"
  | "EServiceDescriptorSuspended"
  | "EServiceDescriptorActivated"
  | "EServiceDescriptorQuotasUpdated"
  | "EServiceDescriptorAgreementApprovalPolicyUpdated"
  | "EServiceDescriptorInterfaceAdded"
  | "EServiceDescriptorDocumentAdded"
  | "EServiceDescriptorInterfaceUpdated"
  | "EServiceDescriptorDocumentUpdated"
  | "EServiceNameUpdatedByTemplateUpdate"
  | "EServiceDescriptionUpdatedByTemplateUpdate"
  | "EServiceDescriptorAttributesUpdatedByTemplateUpdate"
  | "EServiceDescriptorQuotasUpdatedByTemplateUpdate"
  | "EServiceDescriptorDocumentAddedByTemplateUpdate"
  | "EServiceDescriptorDocumentDeletedByTemplateUpdate"
  | "EServiceDescriptorDocumentUpdatedByTemplateUpdate";

export async function handleEserviceStateChangedToConsumer(
  eserviceV2Msg: EServiceV2 | undefined,
  logger: Logger,
  readModelService: ReadModelServiceSQL,
  eventType: EServiceStateChangedEventType
): Promise<NewNotification[]> {
  if (!eserviceV2Msg) {
    throw missingKafkaMessageDataError("eservice", eventType);
  }
  logger.info(
    `Sending in-app notification for handleEserviceStateChangedToConsumer ${eserviceV2Msg.id} eventType ${eventType}`
  );

  const eservice = fromEServiceV2(eserviceV2Msg);
  const descriptor = retrieveLatestPublishedDescriptor(eservice);

  const agreements = await readModelService.getAgreementsByEserviceId(
    eservice.id
  );

  if (!agreements || agreements.length === 0) {
    return [];
  }

  const consumers = await Promise.all(
    agreements.map((consumer) =>
      retrieveTenant(consumer.consumerId, readModelService)
    )
  );
  const userNotificationConfigs =
    await readModelService.getTenantUsersWithNotificationEnabled(
      consumers.map((consumer) => consumer.id),
      "eserviceStateChangedToConsumer"
    );

  const body = getBody(eventType, eservice.name);

  return userNotificationConfigs.map(({ userId, tenantId }) => ({
    userId,
    tenantId,
    body,
    notificationType: "eserviceStateChangedToConsumer",
    entityId: descriptor.id,
  }));
}

function getBody(
  eventType: EServiceStateChangedEventType,
  eserviceName: string
): string {
  return match(eventType)
    .with("EServiceDescriptorPublished", () =>
      inAppTemplates.eserviceDescriptorPublishedToConsumer(eserviceName)
    )
    .with("EServiceDescriptorSuspended", () =>
      inAppTemplates.eserviceDescriptorSuspendedToConsumer(eserviceName)
    )
    .with("EServiceDescriptorActivated", () =>
      inAppTemplates.eserviceDescriptorActivatedToConsumer(eserviceName)
    )
    .with("EServiceDescriptorQuotasUpdated", () =>
      inAppTemplates.eserviceDescriptorQuotasUpdatedToConsumer(eserviceName)
    )
    .with("EServiceDescriptorAgreementApprovalPolicyUpdated", () =>
      inAppTemplates.eserviceDescriptorAgreementApprovalPolicyUpdatedToConsumer(
        eserviceName
      )
    )
    .with("EServiceDescriptorInterfaceAdded", () =>
      inAppTemplates.eserviceDescriptorInterfaceAddedToConsumer(eserviceName)
    )
    .with("EServiceDescriptorDocumentAdded", () =>
      inAppTemplates.eserviceDescriptorDocumentAddedToConsumer(eserviceName)
    )
    .with("EServiceDescriptorInterfaceUpdated", () =>
      inAppTemplates.eserviceDescriptorInterfaceUpdatedToConsumer(eserviceName)
    )
    .with("EServiceDescriptorDocumentUpdated", () =>
      inAppTemplates.eserviceDescriptorDocumentUpdatedToConsumer(eserviceName)
    )
    .with("EServiceNameUpdatedByTemplateUpdate", () =>
      inAppTemplates.eserviceNameUpdatedByTemplateUpdateToConsumer(eserviceName)
    )
    .with("EServiceDescriptionUpdatedByTemplateUpdate", () =>
      inAppTemplates.eserviceDescriptionUpdatedByTemplateUpdateToConsumer(
        eserviceName
      )
    )
    .with("EServiceDescriptorAttributesUpdatedByTemplateUpdate", () =>
      inAppTemplates.eserviceDescriptorAttributesUpdatedByTemplateUpdateToConsumer(
        eserviceName
      )
    )
    .with("EServiceDescriptorQuotasUpdatedByTemplateUpdate", () =>
      inAppTemplates.eserviceDescriptorQuotasUpdatedByTemplateUpdateToConsumer(
        eserviceName
      )
    )
    .with("EServiceDescriptorDocumentAddedByTemplateUpdate", () =>
      inAppTemplates.eserviceDescriptorDocumentAddedByTemplateUpdateToConsumer(
        eserviceName
      )
    )
    .with("EServiceDescriptorDocumentDeletedByTemplateUpdate", () =>
      inAppTemplates.eserviceDescriptorDocumentDeletedByTemplateUpdateToConsumer(
        eserviceName
      )
    )
    .with("EServiceDescriptorDocumentUpdatedByTemplateUpdate", () =>
      inAppTemplates.eserviceDescriptorDocumentUpdatedByTemplateUpdateToConsumer(
        eserviceName
      )
    )
    .exhaustive();
}
