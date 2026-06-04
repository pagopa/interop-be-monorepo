import { Logger, logger } from "pagopa-interop-commons";
import {
  CorrelationId,
  NewNotification,
  unsafeBrandId,
} from "pagopa-interop-models";
import { isStale } from "pagopa-interop-notification-commons";
import {
  schedulableEventType,
  ScheduledNotificationRow,
} from "pagopa-interop-scheduled-notification-db-models";
import { match } from "ts-pattern";
import { ReadModelServiceSQL } from "../services/readModelServiceSQL.js";
import { handleEserviceArchivingScheduledReminderInApp } from "./eservices/handleEserviceArchivingScheduledReminderInApp.js";
import { handleEserviceDescriptorArchivingScheduledReminderInApp } from "./eservices/handleEserviceDescriptorArchivingScheduledReminderInApp.js";

const SERVICE_NAME = "scheduled-in-app-notification-dispatcher";

export const dispatchInAppDeliveryBuilder =
  (deps: {
    readModelService: ReadModelServiceSQL;
    stalenessThresholdHours: number;
    rootLog: Logger;
  }) =>
  async (row: ScheduledNotificationRow): Promise<NewNotification[]> => {
    const rowLog = loggerForRow(row);
    if (isStale(row.sendAt, deps.stalenessThresholdHours)) {
      rowLog.info(
        `Skipping stale row ${row.id} (sendAt=${row.sendAt.toISOString()}, threshold=${deps.stalenessThresholdHours}h)`
      );
      return [];
    }
    return match(row.eventType)
      .with(schedulableEventType.eserviceArchivingScheduled, () =>
        handleEserviceArchivingScheduledReminderInApp(
          row,
          deps.readModelService,
          rowLog
        )
      )
      .with(schedulableEventType.eserviceDescriptorArchivingScheduled, () =>
        handleEserviceDescriptorArchivingScheduledReminderInApp(
          row,
          deps.readModelService,
          rowLog
        )
      )
      .otherwise(() => {
        deps.rootLog.warn(
          `Unhandled scheduled event_type ${row.eventType} for row ${row.id}`
        );
        return [];
      });
  };

const loggerForRow = (row: ScheduledNotificationRow): Logger =>
  logger({
    serviceName: SERVICE_NAME,
    correlationId: unsafeBrandId<CorrelationId>(row.correlationId),
    eventType: row.eventType,
    streamId: row.entityId,
  });
