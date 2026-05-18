import {
  CorrelationId,
  EmailNotificationMessagePayload,
} from "pagopa-interop-models";
import { HtmlTemplateService, Logger } from "pagopa-interop-commons";
import {
  schedulableEventType,
  ScheduledNotificationRow,
} from "pagopa-interop-scheduled-notification-db-models";
import { match } from "ts-pattern";
import { ReadModelServiceSQL } from "../services/readModelServiceSQL.js";
import { handleEserviceStateChangedReminderEmail } from "./eservices/handleEserviceStateChangedReminderEmail.js";

export const dispatchEmailDeliveryBuilder =
  (deps: {
    readModelService: ReadModelServiceSQL;
    templateService: HtmlTemplateService;
    bffUrl: string;
    correlationId: CorrelationId;
    log: Logger;
  }) =>
  async (
    row: ScheduledNotificationRow
  ): Promise<EmailNotificationMessagePayload[]> =>
    match(row.eventType)
      .with(
        schedulableEventType.eserviceArchivingScheduled,
        schedulableEventType.eserviceDescriptorArchivingScheduled,
        () => handleEserviceStateChangedReminderEmail(row, deps)
      )
      .otherwise(() => {
        deps.log.warn(
          `Unhandled scheduled event_type ${row.eventType} for row ${row.id}`
        );
        return [];
      });
