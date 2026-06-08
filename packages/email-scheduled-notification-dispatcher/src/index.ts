import { initProducer } from "kafka-iam-auth";
import {
  CorrelationId,
  NotificationType,
  generateId,
} from "pagopa-interop-models";
import { buildHTMLTemplateService, logger } from "pagopa-interop-commons";
import {
  agreementReadModelServiceBuilder,
  attributeReadModelServiceBuilder,
  catalogReadModelServiceBuilder,
  delegationReadModelServiceBuilder,
  makeDrizzleConnection,
  notificationConfigReadModelServiceBuilder,
  purposeReadModelServiceBuilder,
  tenantReadModelServiceBuilder,
} from "pagopa-interop-readmodel";
import {
  registerEmailTemplatePartials,
  runScheduledDeliveryBatch,
} from "pagopa-interop-notification-commons";
import {
  makeScheduledNotificationDrizzleConnection,
  scheduledNotificationChannel,
} from "pagopa-interop-scheduled-notification-db-models";
import { config } from "./config/config.js";
import { dispatchEmailDeliveryBuilder } from "./handlers/dispatchEmailDelivery.js";
import { emailKafkaSinkBuilder } from "./services/emailKafkaSinkService.js";
import { readModelServiceBuilderSQL } from "./services/readModelServiceSQL.js";

const correlationId = generateId<CorrelationId>();
const log = logger({
  serviceName: "email-scheduled-notification-dispatcher",
  correlationId,
});

log.info("Scheduled email notification dispatcher job started");

const scheduledDb = makeScheduledNotificationDrizzleConnection(config);
const readModelDb = makeDrizzleConnection(config);

const readModelService = readModelServiceBuilderSQL({
  readModelDb,
  agreementReadModelServiceSQL: agreementReadModelServiceBuilder(readModelDb),
  attributeReadModelServiceSQL: attributeReadModelServiceBuilder(readModelDb),
  catalogReadModelServiceSQL: catalogReadModelServiceBuilder(readModelDb),
  delegationReadModelServiceSQL: delegationReadModelServiceBuilder(readModelDb),
  tenantReadModelServiceSQL: tenantReadModelServiceBuilder(readModelDb),
  notificationConfigReadModelServiceSQL:
    notificationConfigReadModelServiceBuilder(readModelDb),
  purposeReadModelServiceSQL: purposeReadModelServiceBuilder(readModelDb),
  notificationTypeBlocklist:
    config.notificationTypeBlocklist as NotificationType[],
});

const templateService = buildHTMLTemplateService();
registerEmailTemplatePartials(templateService);

const producer = await initProducer(config, config.emailDispatchTopic);
const emailSink = emailKafkaSinkBuilder(producer, log);
const dispatch = dispatchEmailDeliveryBuilder({
  readModelService,
  templateService,
  bffUrl: config.bffUrl,
  rootLog: log,
});

try {
  const counters = await runScheduledDeliveryBatch({
    channel: scheduledNotificationChannel.email,
    batchSize: config.deliveryBatchSize,
    maxBatchesPerRun: config.maxBatchesPerRun,
    maxAttempts: config.maxAttempts,
    stalenessThresholdHours:
      config.scheduledNotificationStalenessThresholdHours,
    db: scheduledDb,
    dispatch,
    sink: emailSink.sendEmails,
    log,
  });
  log.info(
    `Done. processed=${counters.processed} skipped=${counters.skipped} skippedStale=${counters.skippedStale} failed=${counters.failed}`
  );
} catch (err) {
  log.error(`Unhandled error: ${String(err)}`);
  await producer.disconnect();
  process.exit(1);
}

await producer.disconnect();
process.exit(0);
