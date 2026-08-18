import { Logger } from "pagopa-interop-commons";
import {
  EService,
  EServiceId,
  NewNotification,
  TenantId,
} from "pagopa-interop-models";
import {
  getNotificationRecipients,
  inAppTemplates,
} from "pagopa-interop-notification-commons";
import {
  ScheduledNotificationRow,
  parseEServiceEntityId,
} from "pagopa-interop-scheduled-notification-db-models";

import { ReadModelServiceSQL } from "../../services/readModelServiceSQL.js";

export async function handleEserviceArchivingScheduledReminderInApp(
  row: ScheduledNotificationRow,
  readModelService: ReadModelServiceSQL,
  log: Logger
): Promise<NewNotification[]> {
  const eserviceId = parseEServiceEntityId(row.entityId);
  const eservice = await readModelService.getEServiceById(eserviceId);
  if (!eservice) {
    log.warn(
      `Skipping scheduled in-app reminder: eservice ${eserviceId} not found in readmodel (row ${row.id})`
    );
    return [];
  }
  const targets = eservice.descriptors.filter(
    (d) => d.archivingSchedule?.scope === "EService"
  );
  if (targets.length === 0) {
    log.warn(
      `Skipping scheduled in-app reminder: eservice ${eserviceId} has no descriptors with archivingSchedule.scope === "EService" (row ${row.id})`
    );
    return [];
  }
  const archivableOns = targets
    .map((d) => d.archivingSchedule?.archivableOn)
    .filter((d): d is Date => d !== undefined);
  if (archivableOns.length === 0) {
    log.warn(
      `Skipping scheduled in-app reminder: eservice ${eserviceId} has eservice-scope descriptors with no archivableOn (row ${row.id})`
    );
    return [];
  }
  const archivableOn = new Date(
    Math.min(...archivableOns.map((d) => d.getTime()))
  );

  const producerNotifications = await buildProducerNotifications({
    eservice,
    archivableOn,
    entityId: eserviceId,
    readModelService,
    log,
  });

  const consumerNotifications = await buildConsumerNotifications({
    eservice,
    archivableOn,
    entityId: eserviceId,
    readModelService,
    log,
  });

  return [...producerNotifications, ...consumerNotifications];
}

type BuilderParams = {
  eservice: EService;
  archivableOn: Date;
  entityId: EServiceId;
  readModelService: ReadModelServiceSQL;
  log: Logger;
};

async function buildProducerNotifications({
  eservice,
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
    body: inAppTemplates.eserviceArchivingScheduledReminderToProducer(
      eservice.name,
      archivableOn
    ),
    notificationType: "eserviceStateChangedToProducer",
    entityId,
  }));
}

async function buildConsumerNotifications({
  eservice,
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

  const recipients = await getNotificationRecipients(
    consumerIds,
    "eserviceStateChangedToConsumer",
    readModelService,
    log
  );
  return recipients.map(({ userId, tenantId }) => ({
    userId,
    tenantId,
    body: inAppTemplates.eserviceArchivingScheduledReminderToConsumer(
      eservice.name,
      archivableOn
    ),
    notificationType: "eserviceStateChangedToConsumer",
    entityId,
  }));
}
