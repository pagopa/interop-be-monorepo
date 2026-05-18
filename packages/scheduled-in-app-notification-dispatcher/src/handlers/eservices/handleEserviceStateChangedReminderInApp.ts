import { differenceInDays } from "date-fns";
import { Logger } from "pagopa-interop-commons";
import {
  Descriptor,
  EService,
  EServiceIdDescriptorId,
  NewNotification,
  TenantId,
} from "pagopa-interop-models";
import {
  getNotificationRecipients,
  inAppTemplates,
} from "pagopa-interop-notification-commons";
import {
  ScheduledNotificationRow,
  parseEntityId,
} from "pagopa-interop-scheduled-notification-db-models";
import { ReadModelServiceSQL } from "../../services/readModelServiceSQL.js";

export async function handleEserviceStateChangedReminderInApp(
  row: ScheduledNotificationRow,
  readModelService: ReadModelServiceSQL,
  log: Logger
): Promise<NewNotification[]> {
  const { eserviceId, descriptorId } = parseEntityId(row.entityId);
  const eservice = await readModelService.getEServiceById(eserviceId);
  if (!eservice) {
    log.warn(
      `Skipping scheduled in-app reminder: eservice ${eserviceId} not found in readmodel (row ${row.id})`
    );
    return [];
  }
  const descriptor = eservice.descriptors.find((d) => d.id === descriptorId);
  if (!descriptor) {
    log.warn(
      `Skipping scheduled in-app reminder: descriptor ${descriptorId} not found in eservice ${eserviceId} (row ${row.id})`
    );
    return [];
  }
  if (!descriptor.archivingSchedule) {
    log.warn(
      `Skipping scheduled in-app reminder: descriptor ${descriptorId} has no archivingSchedule (row ${row.id})`
    );
    return [];
  }

  const archivableOn = descriptor.archivingSchedule.archivableOn;
  const daysRemaining = Math.max(differenceInDays(archivableOn, new Date()), 0);

  const entityId = EServiceIdDescriptorId.parse(
    `${eservice.id}/${descriptor.id}`
  );

  const producerNotifications = await buildProducerNotifications({
    eservice,
    descriptor,
    daysRemaining,
    archivableOn,
    entityId,
    readModelService,
    log,
  });

  const consumerNotifications = await buildConsumerNotifications({
    eservice,
    descriptor,
    daysRemaining,
    archivableOn,
    entityId,
    readModelService,
    log,
  });

  return [...producerNotifications, ...consumerNotifications];
}

type BuilderParams = {
  eservice: EService;
  descriptor: Descriptor;
  daysRemaining: number;
  archivableOn: Date;
  entityId: EServiceIdDescriptorId;
  readModelService: ReadModelServiceSQL;
  log: Logger;
};

async function buildProducerNotifications({
  eservice,
  descriptor,
  daysRemaining,
  archivableOn,
  entityId,
  readModelService,
  log,
}: BuilderParams): Promise<NewNotification[]> {
  const recipients = await getNotificationRecipients(
    [eservice.producerId],
    "eserviceStateChangedToProducer",
    readModelService,
    log
  );
  return recipients.map(({ userId, tenantId }) => ({
    userId,
    tenantId,
    body: inAppTemplates.eserviceStateChangedToProducerScheduledReminder(
      eservice.name,
      descriptor.version,
      daysRemaining,
      archivableOn
    ),
    notificationType: "eserviceStateChangedToProducer",
    entityId,
  }));
}

async function buildConsumerNotifications({
  eservice,
  descriptor,
  daysRemaining,
  archivableOn,
  entityId,
  readModelService,
  log,
}: BuilderParams): Promise<NewNotification[]> {
  const agreements = await readModelService.getAgreementsByEserviceId(
    eservice.id,
    { includeArchived: false }
  );
  const consumerIds = Array.from(
    new Set(agreements.map((a) => a.consumerId))
  ) as TenantId[];
  if (consumerIds.length === 0) {
    return [];
  }

  const producerTenant = await readModelService.getTenantById(
    eservice.producerId
  );
  const producerName = producerTenant?.name ?? eservice.producerId;

  const recipients = await getNotificationRecipients(
    consumerIds,
    "eserviceStateChangedToConsumer",
    readModelService,
    log
  );
  return recipients.map(({ userId, tenantId }) => ({
    userId,
    tenantId,
    body: inAppTemplates.eserviceStateChangedToConsumerScheduledReminder(
      eservice.name,
      descriptor.version,
      daysRemaining,
      archivableOn,
      producerName
    ),
    notificationType: "eserviceStateChangedToConsumer",
    entityId,
  }));
}
