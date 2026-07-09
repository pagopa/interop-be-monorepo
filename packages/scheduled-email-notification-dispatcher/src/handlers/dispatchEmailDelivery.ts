import { HtmlTemplateService, Logger, logger } from "pagopa-interop-commons";
import {
  CorrelationId,
  EmailNotificationMessagePayload,
  unsafeBrandId,
} from "pagopa-interop-models";
import { isStale } from "pagopa-interop-notification-commons";
import {
  schedulableEventType,
  ScheduledNotificationRow,
} from "pagopa-interop-scheduled-notification-db-models";
import { match } from "ts-pattern";

import { ReadModelServiceSQL } from "../services/readModelServiceSQL.js";
import { handleEserviceArchivingScheduledReminderEmail } from "./eservices/handleEserviceArchivingScheduledReminderEmail.js";
import { handleEserviceDescriptorArchivingScheduledReminderEmail } from "./eservices/handleEserviceDescriptorArchivingScheduledReminderEmail.js";

const SERVICE_NAME = "scheduled-email-notification-dispatcher";

export const dispatchEmailDeliveryBuilder =
  (deps: {
    readModelService: ReadModelServiceSQL;
    templateService: HtmlTemplateService;
    bffUrl: string;
    stalenessThresholdHours: number;
    rootLog: Logger;
  }) =>
  async (
    row: ScheduledNotificationRow
  ): Promise<EmailNotificationMessagePayload[]> => {
    const rowCorrelationId = unsafeBrandId<CorrelationId>(row.correlationId);
    const rowLog = logger({
      serviceName: SERVICE_NAME,
      correlationId: rowCorrelationId,
      eventType: row.eventType,
      streamId: row.entityId,
    });
    if (isStale(row.sendAt, deps.stalenessThresholdHours)) {
      rowLog.info(
        `Skipping stale row ${row.id} (sendAt=${row.sendAt.toISOString()}, threshold=${deps.stalenessThresholdHours}h)`
      );
      return [];
    }
    const handlerDeps = {
      readModelService: deps.readModelService,
      templateService: deps.templateService,
      bffUrl: deps.bffUrl,
      correlationId: rowCorrelationId,
      log: rowLog,
    };
    return match(row.eventType)
      .with(schedulableEventType.eserviceArchivingScheduled, () =>
        handleEserviceArchivingScheduledReminderEmail(row, handlerDeps)
      )
      .with(schedulableEventType.eserviceDescriptorArchivingScheduled, () =>
        handleEserviceDescriptorArchivingScheduledReminderEmail(
          row,
          handlerDeps
        )
      )
      .otherwise(() => {
        deps.rootLog.warn(
          `Unhandled scheduled event_type ${row.eventType} for row ${row.id}`
        );
        return [];
      });
  };
