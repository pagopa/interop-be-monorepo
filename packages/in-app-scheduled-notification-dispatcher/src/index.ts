import { drizzle } from "drizzle-orm/node-postgres";
import {
  CorrelationId,
  NotificationType,
  generateId,
} from "pagopa-interop-models";
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
import { logger } from "pagopa-interop-commons";
import {
  makeScheduledNotificationDrizzleConnection,
  scheduledNotificationChannel,
} from "pagopa-interop-scheduled-notification-db-models";
import { runScheduledDeliveryBatch } from "pagopa-interop-notification-commons";
import pg from "pg";
import { config } from "./config/config.js";
import { dispatchInAppDeliveryBuilder } from "./handlers/dispatchInAppDelivery.js";
import { inAppNotificationSinkBuilder } from "./services/inAppNotificationSinkService.js";
import { readModelServiceBuilderSQL } from "./services/readModelServiceSQL.js";

const correlationId = generateId<CorrelationId>();
const log = logger({
  serviceName: "in-app-scheduled-notification-dispatcher",
  correlationId,
});

log.info("Scheduled in-app notification dispatcher job started");

const scheduledDb = makeScheduledNotificationDrizzleConnection(config);
const readModelDb = makeDrizzleConnection(config);
const inAppDb = drizzle({
  client: new pg.Pool({
    host: config.inAppNotificationDBHost,
    port: config.inAppNotificationDBPort,
    database: config.inAppNotificationDBName,
    user: config.inAppNotificationDBUsername,
    password: config.inAppNotificationDBPassword,
    ssl: config.inAppNotificationDBUseSSL
      ? { rejectUnauthorized: false }
      : undefined,
  }),
});

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

const inAppSink = inAppNotificationSinkBuilder(inAppDb, log);
const dispatch = dispatchInAppDeliveryBuilder({
  readModelService,
  rootLog: log,
});

try {
  const counters = await runScheduledDeliveryBatch({
    channel: scheduledNotificationChannel.inApp,
    batchSize: config.deliveryBatchSize,
    maxBatchesPerRun: config.maxBatchesPerRun,
    maxAttempts: config.maxAttempts,
    stalenessThresholdHours:
      config.scheduledNotificationStalenessThresholdHours,
    db: scheduledDb,
    dispatch,
    sink: inAppSink.insertNotifications,
    log,
  });
  log.info(
    `Done. processed=${counters.processed} skipped=${counters.skipped} skippedStale=${counters.skippedStale} failed=${counters.failed}`
  );
  process.exit(0);
} catch (err) {
  log.error(`Unhandled error: ${String(err)}`);
  process.exit(1);
}
