import {
  EService,
  EServiceEventV2,
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

type EServiceStateChangedEvent = Extract<
  EServiceEventV2,
  { type: EServiceStateChangedEventType }
>;

export async function handleEserviceStateChangedToConsumer(
  eserviceV2Msg: EServiceStateChangedEvent,
  logger: Logger,
  readModelService: ReadModelServiceSQL
): Promise<NewNotification[]> {
  if (!eserviceV2Msg.data.eservice) {
    throw missingKafkaMessageDataError("eservice", eserviceV2Msg.type);
  }
  logger.info(
    `Sending in-app notification for handleEserviceStateChangedToConsumer ${eserviceV2Msg.data.eservice.id} eventType ${eserviceV2Msg.type}`
  );

  const eservice = fromEServiceV2(eserviceV2Msg.data.eservice);

  // FIXME: what if is not the latest descriptor? Is it ok to navigate the user always to the latest?
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

  const body = getBody(eserviceV2Msg, eservice);

  return userNotificationConfigs.map(({ userId, tenantId }) => ({
    userId,
    tenantId,
    body,
    notificationType: "eserviceStateChangedToConsumer",
    entityId: descriptor.id,
  }));
}

function getInterfaceName(
  eservice: EService,
  descriptorId: string
): string | undefined {
  const descriptor = eservice.descriptors.find((d) => d.id === descriptorId);
  return descriptor?.interface?.prettyName;
}

function getDocumentName(
  eservice: EService,
  descriptorId: string,
  documentId: string
): string | undefined {
  const descriptor = eservice.descriptors.find((d) => d.id === descriptorId);
  return descriptor?.docs?.find((d) => d.id === documentId)?.prettyName;
}

function getBody(msg: EServiceStateChangedEvent, eservice: EService): string {
  return match(msg)
    .with({ type: "EServiceDescriptorPublished" }, () =>
      inAppTemplates.eserviceDescriptorPublishedToConsumer(eservice.name)
    )
    .with({ type: "EServiceDescriptorSuspended" }, () =>
      inAppTemplates.eserviceDescriptorSuspendedToConsumer(eservice.name)
    )
    .with({ type: "EServiceDescriptorActivated" }, () =>
      inAppTemplates.eserviceDescriptorActivatedToConsumer(eservice.name)
    )
    .with({ type: "EServiceDescriptorQuotasUpdated" }, () =>
      inAppTemplates.eserviceDescriptorQuotasUpdatedToConsumer(eservice.name)
    )
    .with({ type: "EServiceDescriptorAgreementApprovalPolicyUpdated" }, () =>
      inAppTemplates.eserviceDescriptorAgreementApprovalPolicyUpdatedToConsumer(
        eservice.name
      )
    )
    .with(
      { type: "EServiceDescriptorInterfaceAdded" },
      ({ data: { descriptorId } }) => {
        const interfaceName = getInterfaceName(eservice, descriptorId);
        return inAppTemplates.eserviceDescriptorInterfaceAddedToConsumer(
          eservice.name,
          interfaceName
        );
      }
    )
    .with(
      { type: "EServiceDescriptorDocumentAdded" },
      ({ data: { descriptorId, documentId } }) => {
        const documentName = getDocumentName(
          eservice,
          descriptorId,
          documentId
        );
        return inAppTemplates.eserviceDescriptorDocumentAddedToConsumer(
          eservice.name,
          documentName
        );
      }
    )
    .with(
      { type: "EServiceDescriptorInterfaceUpdated" },
      ({ data: { descriptorId } }) => {
        const interfaceName = getInterfaceName(eservice, descriptorId);
        return inAppTemplates.eserviceDescriptorInterfaceUpdatedToConsumer(
          eservice.name,
          interfaceName
        );
      }
    )
    .with(
      { type: "EServiceDescriptorDocumentUpdated" },
      ({ data: { descriptorId, documentId } }) => {
        const documentName = getDocumentName(
          eservice,
          descriptorId,
          documentId
        );
        return inAppTemplates.eserviceDescriptorDocumentUpdatedToConsumer(
          eservice.name,
          documentName
        );
      }
    )
    .with({ type: "EServiceNameUpdatedByTemplateUpdate" }, () =>
      inAppTemplates.eserviceNameUpdatedByTemplateUpdateToConsumer(
        eservice.name
      )
    )
    .with({ type: "EServiceDescriptionUpdatedByTemplateUpdate" }, () =>
      inAppTemplates.eserviceDescriptionUpdatedByTemplateUpdateToConsumer(
        eservice.name
      )
    )
    .with({ type: "EServiceDescriptorAttributesUpdatedByTemplateUpdate" }, () =>
      inAppTemplates.eserviceDescriptorAttributesUpdatedByTemplateUpdateToConsumer(
        eservice.name
      )
    )
    .with({ type: "EServiceDescriptorQuotasUpdatedByTemplateUpdate" }, () =>
      inAppTemplates.eserviceDescriptorQuotasUpdatedByTemplateUpdateToConsumer(
        eservice.name
      )
    )
    .with({ type: "EServiceDescriptorDocumentAddedByTemplateUpdate" }, () =>
      inAppTemplates.eserviceDescriptorDocumentAddedByTemplateUpdateToConsumer(
        eservice.name
      )
    )
    .with({ type: "EServiceDescriptorDocumentDeletedByTemplateUpdate" }, () =>
      inAppTemplates.eserviceDescriptorDocumentDeletedByTemplateUpdateToConsumer(
        eservice.name
      )
    )
    .with({ type: "EServiceDescriptorDocumentUpdatedByTemplateUpdate" }, () =>
      inAppTemplates.eserviceDescriptorDocumentUpdatedByTemplateUpdateToConsumer(
        eservice.name
      )
    )
    .exhaustive();
}
