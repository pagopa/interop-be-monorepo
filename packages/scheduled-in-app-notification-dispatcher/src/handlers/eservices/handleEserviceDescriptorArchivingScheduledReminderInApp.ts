import { Logger } from "pagopa-interop-commons";
import {
  Descriptor,
  EService,
  EServiceIdDescriptorId,
  NewNotification,
} from "pagopa-interop-models";
import {
  getNotificationRecipients,
  inAppTemplates,
} from "pagopa-interop-notification-commons";
import {
  ScheduledNotificationRow,
  parseEServiceIdDescriptorId,
} from "pagopa-interop-scheduled-notification-db-models";
import { ReadModelServiceSQL } from "../../services/readModelServiceSQL.js";

export async function handleEserviceDescriptorArchivingScheduledReminderInApp(
  row: ScheduledNotificationRow,
  readModelService: ReadModelServiceSQL,
  log: Logger
): Promise<NewNotification[]> {
  const { eserviceId, descriptorId } = parseEServiceIdDescriptorId(
    row.entityId
  );
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
  if (descriptor.archivingSchedule.scope !== "Descriptor") {
    log.warn(
      `Skipping scheduled in-app reminder: descriptor ${descriptorId} has archivingSchedule.scope="${descriptor.archivingSchedule.scope}", expected "Descriptor" (row ${row.id})`
    );
    return [];
  }

  const archivableOn = descriptor.archivingSchedule.archivableOn;

  const entityId = EServiceIdDescriptorId.parse(
    `${eservice.id}/${descriptor.id}`
  );

  const producerNotifications = await buildProducerNotifications({
    eservice,
    descriptor,
    archivableOn,
    entityId,
    readModelService,
    log,
  });

  return producerNotifications;
}

type BuilderParams = {
  eservice: EService;
  descriptor: Descriptor;
  archivableOn: Date;
  entityId: EServiceIdDescriptorId;
  readModelService: ReadModelServiceSQL;
  log: Logger;
};

async function buildProducerNotifications({
  eservice,
  descriptor,
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
    body: inAppTemplates.eserviceDescriptorArchivingScheduledReminderToProducer(
      eservice.name,
      descriptor.version,
      archivableOn
    ),
    notificationType: "eserviceStateChangedToProducer",
    entityId,
  }));
}
