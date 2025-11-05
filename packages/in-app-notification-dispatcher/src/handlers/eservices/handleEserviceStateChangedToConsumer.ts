import {
  DescriptorId,
  EService,
  EServiceEventV2,
  EServiceIdDescriptorId,
  fromEServiceV2,
  missingKafkaMessageDataError,
  NewNotification,
  unsafeBrandId,
} from "pagopa-interop-models";
import { Logger } from "pagopa-interop-commons";
import { match, P } from "ts-pattern";
import { ReadModelServiceSQL } from "../../services/readModelServiceSQL.js";
import { inAppTemplates } from "../../templates/inAppTemplates.js";
import {
  retrieveLatestPublishedDescriptor,
  retrieveTenant,
} from "../handlerCommons.js";

type EServiceStateChangedEventType =
  | "EServiceNameUpdated"
  | "EServiceDescriptionUpdated"
  | "EServiceDescriptorAttributesUpdated"
  | "EServiceDescriptorPublished"
  | "EServiceDescriptorSuspended"
  | "EServiceDescriptorActivated"
  | "EServiceDescriptorQuotasUpdated"
  | "EServiceDescriptorAgreementApprovalPolicyUpdated"
  | "EServiceDescriptorInterfaceAdded"
  | "EServiceDescriptorDocumentAdded"
  | "EServiceDescriptorDocumentDeleted"
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

  const { body, descriptorId: descriptorIdFromEvent } = getBodyAndDescriptorId(
    eserviceV2Msg,
    eservice
  );

  const descriptorId = descriptorIdFromEvent
    ? unsafeBrandId<DescriptorId>(descriptorIdFromEvent)
    : retrieveLatestPublishedDescriptor(eservice).id;

  const entityId = EServiceIdDescriptorId.parse(
    `${eservice.id}/${descriptorId}`
  );

  return userNotificationConfigs.map(({ userId, tenantId }) => ({
    userId,
    tenantId,
    body,
    notificationType: "eserviceStateChangedToConsumer",
    entityId,
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

function getBodyAndDescriptorId(
  msg: EServiceStateChangedEvent,
  eservice: EService
): {
  body: string;
  descriptorId?: string | undefined;
} {
  return match(msg)
    .with(
      {
        type: P.union(
          "EServiceNameUpdated",
          "EServiceNameUpdatedByTemplateUpdate"
        ),
      },
      ({ data: { oldName } }) => ({
        body: inAppTemplates.eserviceNameUpdatedToConsumer(eservice, oldName),
      })
    )
    .with(
      {
        type: P.union(
          "EServiceDescriptionUpdated",
          "EServiceDescriptionUpdatedByTemplateUpdate"
        ),
      },
      () => ({
        body: inAppTemplates.eserviceDescriptionUpdatedToConsumer(
          eservice.name
        ),
      })
    )
    .with(
      {
        type: P.union(
          "EServiceDescriptorAttributesUpdated",
          "EServiceDescriptorAttributesUpdatedByTemplateUpdate"
        ),
      },
      ({ data: { descriptorId } }) => ({
        body: inAppTemplates.eserviceDescriptorAttributesUpdatedToConsumer(
          eservice.name
        ),
        descriptorId,
      })
    )
    .with(
      { type: "EServiceDescriptorPublished" },
      ({ data: { descriptorId } }) => ({
        body: inAppTemplates.eserviceDescriptorPublishedToConsumer(
          eservice.name
        ),
        descriptorId,
      })
    )
    .with(
      { type: "EServiceDescriptorSuspended" },
      ({ data: { descriptorId } }) => ({
        body: inAppTemplates.eserviceDescriptorSuspendedToConsumer(
          eservice.name
        ),
        descriptorId,
      })
    )
    .with(
      { type: "EServiceDescriptorActivated" },
      ({ data: { descriptorId } }) => ({
        body: inAppTemplates.eserviceDescriptorActivatedToConsumer(
          eservice.name
        ),
        descriptorId,
      })
    )
    .with(
      {
        type: P.union(
          "EServiceDescriptorQuotasUpdated",
          "EServiceDescriptorQuotasUpdatedByTemplateUpdate"
        ),
      },
      ({ data: { descriptorId } }) => ({
        body: inAppTemplates.eserviceDescriptorQuotasUpdatedToConsumer(
          eservice.name
        ),
        descriptorId,
      })
    )
    .with(
      { type: "EServiceDescriptorAgreementApprovalPolicyUpdated" },
      ({ data: { descriptorId } }) => ({
        body: inAppTemplates.eserviceDescriptorAgreementApprovalPolicyUpdatedToConsumer(
          eservice.name
        ),
        descriptorId,
      })
    )
    .with(
      { type: "EServiceDescriptorInterfaceAdded" },
      ({ data: { descriptorId } }) => {
        const interfaceName = getInterfaceName(eservice, descriptorId);
        return {
          body: inAppTemplates.eserviceDescriptorInterfaceAddedToConsumer(
            eservice.name,
            interfaceName
          ),
          descriptorId,
        };
      }
    )
    .with(
      {
        type: P.union(
          "EServiceDescriptorDocumentAdded",
          "EServiceDescriptorDocumentAddedByTemplateUpdate"
        ),
      },
      ({ data: { descriptorId, documentId } }) => {
        const documentName = getDocumentName(
          eservice,
          descriptorId,
          documentId
        );
        return {
          body: inAppTemplates.eserviceDescriptorDocumentAddedToConsumer(
            eservice.name,
            documentName
          ),
          descriptorId,
        };
      }
    )
    .with(
      {
        type: P.union(
          "EServiceDescriptorDocumentDeleted",
          "EServiceDescriptorDocumentDeletedByTemplateUpdate"
        ),
      },
      ({ data: { descriptorId, documentId } }) => {
        const documentName = getDocumentName(
          eservice,
          descriptorId,
          documentId
        );
        return {
          body: inAppTemplates.eserviceDescriptorDocumentDeletedToConsumer(
            eservice.name,
            documentName
          ),
          descriptorId,
        };
      }
    )
    .with(
      { type: "EServiceDescriptorInterfaceUpdated" },
      ({ data: { descriptorId } }) => {
        const interfaceName = getInterfaceName(eservice, descriptorId);
        return {
          body: inAppTemplates.eserviceDescriptorInterfaceUpdatedToConsumer(
            eservice.name,
            interfaceName
          ),
          descriptorId,
        };
      }
    )
    .with(
      {
        type: P.union(
          "EServiceDescriptorDocumentUpdated",
          "EServiceDescriptorDocumentUpdatedByTemplateUpdate"
        ),
      },
      ({ data: { descriptorId, documentId } }) => {
        const documentName = getDocumentName(
          eservice,
          descriptorId,
          documentId
        );
        return {
          body: inAppTemplates.eserviceDescriptorDocumentUpdatedToConsumer(
            eservice.name,
            documentName
          ),
          descriptorId,
        };
      }
    )
    .exhaustive();
}
