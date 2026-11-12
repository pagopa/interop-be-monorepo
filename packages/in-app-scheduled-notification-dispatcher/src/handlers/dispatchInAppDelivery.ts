import { Logger, logger } from "pagopa-interop-commons";
import {
  CorrelationId,
  NewNotification,
  unsafeBrandId,
} from "pagopa-interop-models";
import {
  schedulableEventType,
  ScheduledNotificationRow,
} from "pagopa-interop-scheduled-notification-db-models";
import { match } from "ts-pattern";

import { ReadModelServiceSQL } from "../services/readModelServiceSQL.js";
import { handleEserviceArchivingScheduledReminderInApp } from "./eservices/handleEserviceArchivingScheduledReminderInApp.js";
import { handleEserviceDescriptorArchivingScheduledReminderInApp } from "./eservices/handleEserviceDescriptorArchivingScheduledReminderInApp.js";

const SERVICE_NAME = "in-app-scheduled-notification-dispatcher";

export const dispatchInAppDeliveryBuilder =
  (deps: { readModelService: ReadModelServiceSQL; rootLog: Logger }) =>
  async (row: ScheduledNotificationRow): Promise<NewNotification[]> => {
    // staleness is enforced by runScheduledDeliveryBatch before dispatch
    const rowLog = loggerForRow(row);
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
