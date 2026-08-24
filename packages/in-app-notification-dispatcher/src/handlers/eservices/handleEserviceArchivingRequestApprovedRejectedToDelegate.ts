import { Logger } from "pagopa-interop-commons";
import {
  DescriptorId,
  EServiceIdDescriptorId,
  EServiceEventV2,
  NewNotification,
  TenantId,
  fromEServiceV2,
  missingKafkaMessageDataError,
  unsafeBrandId,
} from "pagopa-interop-models";
import {
  archivingRequesterIdNotFound,
  getNotificationRecipients,
  inAppTemplates,
  retrieveDescriptor,
  retrieveLatestDescriptor,
  retrieveTenant,
} from "pagopa-interop-notification-commons";
import { match } from "ts-pattern";

import { ReadModelServiceSQL } from "../../services/readModelServiceSQL.js";

type ArchivingRequestApprovedRejectedEventType =
  | "EServiceDescriptorArchivingRequestApprovedByDelegator"
  | "EServiceDescriptorArchivingRequestRejectedByDelegator"
  | "EServiceArchivingRequestApprovedByDelegator"
  | "EServiceArchivingRequestRejectedByDelegator";

type ArchivingRequestApprovedRejectedEvent = Extract<
  EServiceEventV2,
  { type: ArchivingRequestApprovedRejectedEventType }
>;

function getRequesterIdFromLatestArchivingRequest(
  requests:
    | Array<{
        requesterId: TenantId;
        requestedAt: Date;
        acceptedAt?: Date;
        rejectedAt?: Date;
      }>
    | undefined
): TenantId | undefined {
  if (!requests || requests.length === 0) {
    return undefined;
  }

  const latestRequest = requests.reduce((latest, current) => {
    const latestDate =
      latest.acceptedAt ?? latest.rejectedAt ?? latest.requestedAt;
    const currentDate =
      current.acceptedAt ?? current.rejectedAt ?? current.requestedAt;

    return currentDate > latestDate ? current : latest;
  });

  return latestRequest.requesterId;
}

export async function handleEserviceArchivingRequestApprovedRejectedToDelegate(
  msg: ArchivingRequestApprovedRejectedEvent,
  logger: Logger,
  readModelService: ReadModelServiceSQL
): Promise<NewNotification[]> {
  if (!msg.data.eservice) {
    throw missingKafkaMessageDataError("eservice", msg.type);
  }
  const eservice = fromEServiceV2(msg.data.eservice);

  logger.info(
    `Sending in-app notification to delegate for ${msg.type} - eservice ${eservice.id}`
  );

  const requesterId = match(msg)
    .with(
      {
        type: "EServiceDescriptorArchivingRequestApprovedByDelegator",
      },
      ({ data: { descriptorId } }) => {
        const descriptor = retrieveDescriptor(
          eservice,
          unsafeBrandId<DescriptorId>(descriptorId)
        );
        return getRequesterIdFromLatestArchivingRequest(
          descriptor.delegatedArchivingRequest
        );
      }
    )
    .with(
      {
        type: "EServiceDescriptorArchivingRequestRejectedByDelegator",
      },
      ({ data: { descriptorId } }) => {
        const descriptor = retrieveDescriptor(
          eservice,
          unsafeBrandId<DescriptorId>(descriptorId)
        );
        return getRequesterIdFromLatestArchivingRequest(
          descriptor.delegatedArchivingRequest
        );
      }
    )
    .with({ type: "EServiceArchivingRequestApprovedByDelegator" }, () =>
      getRequesterIdFromLatestArchivingRequest(
        eservice.delegatedArchivingRequest
      )
    )
    .with({ type: "EServiceArchivingRequestRejectedByDelegator" }, () =>
      getRequesterIdFromLatestArchivingRequest(
        eservice.delegatedArchivingRequest
      )
    )
    .exhaustive();

  if (!requesterId) {
    throw archivingRequesterIdNotFound(eservice.id, msg.type);
  }

  const usersWithNotifications = await getNotificationRecipients(
    [requesterId],
    "eserviceArchivingApprovedRejectedToDelegate",
    readModelService,
    logger
  );

  if (usersWithNotifications.length === 0) {
    logger.info(
      `No users with notifications enabled for handleEserviceArchivingRequestApprovedRejectedToDelegate - entityId: ${eservice.id}, eventType: ${msg.type}`
    );
    return [];
  }

  const delegator = await retrieveTenant(eservice.producerId, readModelService);

  const { body, entityId } = match(msg)
    .with(
      { type: "EServiceDescriptorArchivingRequestApprovedByDelegator" },
      ({ data: { descriptorId } }) => {
        const descriptor = retrieveDescriptor(
          eservice,
          unsafeBrandId<DescriptorId>(descriptorId)
        );
        return {
          body: inAppTemplates.eserviceDescriptorArchivingRequestApprovedByDelegatorToDelegate(
            delegator.name,
            descriptor.version,
            eservice.name,
            descriptor.archivingSchedule?.archivableOn
          ),
          entityId: EServiceIdDescriptorId.parse(
            `${eservice.id}/${descriptor.id}`
          ),
        };
      }
    )
    .with(
      { type: "EServiceDescriptorArchivingRequestRejectedByDelegator" },
      ({ data: { descriptorId } }) => {
        const descriptor = retrieveDescriptor(
          eservice,
          unsafeBrandId<DescriptorId>(descriptorId)
        );
        return {
          body: inAppTemplates.eserviceDescriptorArchivingRequestRejectedByDelegatorToDelegate(
            delegator.name,
            descriptor.version,
            eservice.name
          ),
          entityId: EServiceIdDescriptorId.parse(
            `${eservice.id}/${descriptor.id}`
          ),
        };
      }
    )
    .with({ type: "EServiceArchivingRequestApprovedByDelegator" }, () => {
      const descriptor = retrieveLatestDescriptor(eservice);
      return {
        body: inAppTemplates.eserviceArchivingRequestApprovedByDelegatorToDelegate(
          delegator.name,
          eservice.name,
          descriptor.archivingSchedule?.archivableOn
        ),
        entityId: EServiceIdDescriptorId.parse(
          `${eservice.id}/${descriptor.id}`
        ),
      };
    })
    .with({ type: "EServiceArchivingRequestRejectedByDelegator" }, () => {
      const descriptor = retrieveLatestDescriptor(eservice);
      return {
        body: inAppTemplates.eserviceArchivingRequestRejectedByDelegatorToDelegate(
          delegator.name,
          eservice.name
        ),
        entityId: EServiceIdDescriptorId.parse(
          `${eservice.id}/${descriptor.id}`
        ),
      };
    })
    .exhaustive();

  return usersWithNotifications.map(({ userId, tenantId }) => ({
    userId,
    tenantId,
    body,
    notificationType: "eserviceArchivingApprovedRejectedToDelegate",
    entityId,
  }));
}
