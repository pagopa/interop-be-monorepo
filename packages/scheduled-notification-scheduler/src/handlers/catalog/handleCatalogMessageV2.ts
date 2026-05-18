import { Logger } from "pagopa-interop-commons";
import {
  CorrelationId,
  Descriptor,
  DescriptorId,
  EServiceEventEnvelopeV2,
  EServiceId,
  EServiceV2,
  fromDescriptorV2,
  fromEServiceV2,
  missingKafkaMessageDataError,
  unsafeBrandId,
} from "pagopa-interop-models";
import { schedulableEventType } from "pagopa-interop-scheduled-notification-db-models";
import { match } from "ts-pattern";
import { SchedulerService } from "../../services/schedulerService.js";

type ReminderConfig = {
  eserviceReminderDays: number[];
  descriptorReminderDays: number[];
  sendAtHour: number;
  tz: string;
};

export const handleCatalogMessageV2 = async (
  decodedMsg: EServiceEventEnvelopeV2,
  correlationId: CorrelationId,
  schedulerService: SchedulerService,
  reminderConfig: ReminderConfig,
  log: Logger
): Promise<void> => {
  await match(decodedMsg)
    .with(
      { type: "EServiceArchivingScheduled" },
      async ({ data: { eservice } }) => {
        if (!eservice) {
          throw missingKafkaMessageDataError("eservice", decodedMsg.type);
        }
        await scheduleForEserviceScope(
          eservice,
          correlationId,
          schedulerService,
          reminderConfig,
          log
        );
      }
    )
    .with(
      { type: "EServiceDescriptorArchivingScheduled" },
      async ({ data: { eservice, descriptorId } }) => {
        if (!eservice) {
          throw missingKafkaMessageDataError("eservice", decodedMsg.type);
        }
        await scheduleForDescriptorScope(
          eservice,
          unsafeBrandId<DescriptorId>(descriptorId),
          correlationId,
          schedulerService,
          reminderConfig,
          log
        );
      }
    )
    .with(
      { type: "EServiceArchivingCanceled" },
      { type: "EServiceArchivingCompleted" },
      async ({ data: { eservice } }) => {
        if (!eservice) {
          throw missingKafkaMessageDataError("eservice", decodedMsg.type);
        }
        await schedulerService.deletePendingByEserviceScope({
          eserviceId: unsafeBrandId<EServiceId>(eservice.id),
          eventType: schedulableEventType.eserviceArchivingScheduled,
        });
        log.info(
          `Deleted pending reminders for eservice ${eservice.id} (event=${decodedMsg.type})`
        );
      }
    )
    .with(
      { type: "EServiceDescriptorArchivingCanceled" },
      { type: "EServiceDescriptorArchivingCompleted" },
      async ({ data: { eservice, descriptorId } }) => {
        if (!eservice) {
          throw missingKafkaMessageDataError("eservice", decodedMsg.type);
        }
        await schedulerService.deletePendingByDescriptorScope({
          eserviceId: unsafeBrandId<EServiceId>(eservice.id),
          descriptorId: unsafeBrandId<DescriptorId>(descriptorId),
          eventType: schedulableEventType.eserviceDescriptorArchivingScheduled,
        });
        log.info(
          `Deleted pending reminders for descriptor ${descriptorId} (event=${decodedMsg.type})`
        );
      }
    )
    .otherwise(() => undefined);
};

const scheduleForEserviceScope = async (
  eservice: EServiceV2,
  correlationId: CorrelationId,
  schedulerService: SchedulerService,
  cfg: ReminderConfig,
  log: Logger
): Promise<void> => {
  const domain = fromEServiceV2(eservice);
  const targets = domain.descriptors.filter(
    (d: Descriptor) => d.archivingSchedule?.scope === "EService"
  );
  if (targets.length === 0) {
    log.warn(
      `EServiceArchivingScheduled for ${domain.id} had no descriptors with archivingSchedule.scope === "EService"; nothing to schedule`
    );
    return;
  }
  for (const descriptor of targets) {
    if (!descriptor.archivingSchedule) {
      continue;
    }
    await schedulerService.scheduleReminders(
      {
        eserviceId: domain.id,
        descriptorId: descriptor.id,
        archivableOn: descriptor.archivingSchedule.archivableOn,
        eventType: schedulableEventType.eserviceArchivingScheduled,
        correlationId,
        reminderDays: cfg.eserviceReminderDays,
        sendAtHour: cfg.sendAtHour,
        tz: cfg.tz,
      },
      log
    );
  }
};

const scheduleForDescriptorScope = async (
  eservice: EServiceV2,
  descriptorId: DescriptorId,
  correlationId: CorrelationId,
  schedulerService: SchedulerService,
  cfg: ReminderConfig,
  log: Logger
): Promise<void> => {
  const descriptor = eservice.descriptors.find((d) => d.id === descriptorId);
  if (!descriptor) {
    log.warn(
      `EServiceDescriptorArchivingScheduled: descriptor ${descriptorId} not present in eservice payload; skipping`
    );
    return;
  }
  const domainDescriptor = fromDescriptorV2(descriptor);
  if (!domainDescriptor.archivingSchedule) {
    log.warn(
      `EServiceDescriptorArchivingScheduled: descriptor ${descriptorId} has no archivingSchedule; skipping`
    );
    return;
  }
  await schedulerService.scheduleReminders(
    {
      eserviceId: unsafeBrandId<EServiceId>(eservice.id),
      descriptorId,
      archivableOn: domainDescriptor.archivingSchedule.archivableOn,
      eventType: schedulableEventType.eserviceDescriptorArchivingScheduled,
      correlationId,
      reminderDays: cfg.descriptorReminderDays,
      sendAtHour: cfg.sendAtHour,
      tz: cfg.tz,
    },
    log
  );
};
