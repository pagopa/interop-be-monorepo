import { runConsumer, EachMessagePayload } from "kafka-iam-auth";
import { decodeKafkaMessage, logger } from "pagopa-interop-commons";
import {
  CorrelationId,
  EServiceEvent,
  generateId,
  unsafeBrandId,
} from "pagopa-interop-models";
import { makeScheduledNotificationDrizzleConnection } from "pagopa-interop-scheduled-notification-db-models";
import { config } from "./config/config.js";
import { schedulerServiceBuilder } from "./services/schedulerService.js";
import { handleCatalogMessageV2 } from "./handlers/catalog/handleCatalogMessageV2.js";

const db = makeScheduledNotificationDrizzleConnection(config);
const schedulerService = schedulerServiceBuilder(db);

const reminderConfig = {
  eserviceReminderDays: config.eserviceManualArchiveReminderDays,
  descriptorReminderDays: config.eserviceDescriptorManualArchiveReminderDays,
  sendAtHour: config.reminderSendAtHour,
  tz: config.reminderSendAtTz,
};

async function processMessage({
  message,
  partition,
}: EachMessagePayload): Promise<void> {
  const decodedMsg = decodeKafkaMessage(message, EServiceEvent);
  const correlationId: CorrelationId = decodedMsg.correlation_id
    ? unsafeBrandId(decodedMsg.correlation_id)
    : generateId();

  const log = logger({
    serviceName: "scheduled-notification-scheduler",
    eventType: decodedMsg.type,
    eventVersion: decodedMsg.event_version,
    streamId: decodedMsg.stream_id,
    streamVersion: decodedMsg.version,
    correlationId,
  });

  log.debug(
    `Processing ${decodedMsg.type} - partition=${partition} offset=${message.offset}`
  );

  if (decodedMsg.event_version === 2) {
    await handleCatalogMessageV2(
      decodedMsg,
      correlationId,
      schedulerService,
      reminderConfig,
      log
    );
  }
}

await runConsumer(
  config,
  [config.catalogTopic],
  processMessage,
  "scheduled-notification-scheduler"
);
