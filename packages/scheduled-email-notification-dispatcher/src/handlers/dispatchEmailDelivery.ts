import {
  CorrelationId,
  EmailNotificationMessagePayload,
  unsafeBrandId,
} from "pagopa-interop-models";
import { HtmlTemplateService, Logger, logger } from "pagopa-interop-commons";
import {
  schedulableEventType,
  ScheduledNotificationRow,
} from "pagopa-interop-scheduled-notification-db-models";
import { match } from "ts-pattern";
import { ReadModelServiceSQL } from "../services/readModelServiceSQL.js";
import { handleEserviceStateChangedReminderEmail } from "./eservices/handleEserviceStateChangedReminderEmail.js";

const SERVICE_NAME = "scheduled-email-notification-dispatcher";

export const dispatchEmailDeliveryBuilder =
  (deps: {
    readModelService: ReadModelServiceSQL;
    templateService: HtmlTemplateService;
    bffUrl: string;
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
    return match(row.eventType)
      .with(
        schedulableEventType.eserviceArchivingScheduled,
        schedulableEventType.eserviceDescriptorArchivingScheduled,
        () =>
          handleEserviceStateChangedReminderEmail(row, {
            readModelService: deps.readModelService,
            templateService: deps.templateService,
            bffUrl: deps.bffUrl,
            correlationId: rowCorrelationId,
            log: rowLog,
          })
      )
      .otherwise(() => {
        deps.rootLog.warn(
          `Unhandled scheduled event_type ${row.eventType} for row ${row.id}`
        );
        return [];
      });
  };
