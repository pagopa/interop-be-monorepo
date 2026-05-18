import { Logger } from "pagopa-interop-commons";
import { NewNotification } from "pagopa-interop-models";
import {
  schedulableEventType,
  ScheduledNotificationRow,
} from "pagopa-interop-scheduled-notification-db-models";
import { match } from "ts-pattern";
import { ReadModelServiceSQL } from "../services/readModelServiceSQL.js";
import { handleEserviceStateChangedReminderInApp } from "./eservices/handleEserviceStateChangedReminderInApp.js";

export const dispatchInAppDeliveryBuilder =
  (deps: { readModelService: ReadModelServiceSQL; log: Logger }) =>
  async (row: ScheduledNotificationRow): Promise<NewNotification[]> =>
    match(row.eventType)
      .with(
        schedulableEventType.eserviceArchivingScheduled,
        schedulableEventType.eserviceDescriptorArchivingScheduled,
        () =>
          handleEserviceStateChangedReminderInApp(
            row,
            deps.readModelService,
            deps.log
          )
      )
      .otherwise(() => {
        deps.log.warn(
          `Unhandled scheduled event_type ${row.eventType} for row ${row.id}`
        );
        return [];
      });
