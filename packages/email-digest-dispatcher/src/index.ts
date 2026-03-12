import { initProducer } from "kafka-iam-auth";
import { buildHTMLTemplateService, logger } from "pagopa-interop-commons";
import { makeDrizzleConnection } from "pagopa-interop-readmodel";
import {
  CorrelationId,
  generateId,
  TenantId,
  unsafeBrandId,
} from "pagopa-interop-models";
import { config } from "./config/config.js";
import {
  readModelServiceBuilder,
  DigestUser,
} from "./services/readModelService.js";
import { digestDataServiceBuilder } from "./services/digestDataService.js";
import { digestTemplateServiceBuilder } from "./services/templateService.js";
import { emailProducerServiceBuilder } from "./services/emailProducerService.js";
import { makeDigestTrackingDbConnection } from "./model/digestTrackingDb.js";
import { digestTrackingServiceBuilder } from "./services/digestTrackingService.js";
import { createResultsCollector } from "./utils/resultsCollector.js";
import { processUserWithTenantData } from "./utils/processUserWithTenantData.js";
import {
  getVisibleSections,
  hasVisibleDigestContent,
} from "./utils/digestAdmittedRoles.js";

const correlationId = generateId<CorrelationId>();
const log = logger({
  serviceName: "email-notification-digest",
  correlationId,
});

log.info("Email Notification Digest job started");

const readModelDB = makeDrizzleConnection(config);
const readModelService = readModelServiceBuilder(readModelDB, log);
const priorityProducerIds = config.priorityProducerIds.map(
  unsafeBrandId<TenantId>
);
const digestDataService = digestDataServiceBuilder(
  readModelService,
  log,
  priorityProducerIds
);
const htmlTemplateService = buildHTMLTemplateService();
const templateService = digestTemplateServiceBuilder(htmlTemplateService);
const producer = await initProducer(config, config.emailDispatchTopic);
const emailProducerService = emailProducerServiceBuilder(producer);
const trackingDb = makeDigestTrackingDbConnection(config);
const trackingService = digestTrackingServiceBuilder(trackingDb);

try {
  log.info("Fetching users with digest preference enabled");
  const digestUsers = await readModelService.getUsersWithDigestPreference();
  log.info(`Found ${digestUsers.length} users with digest preference enabled`);

  if (digestUsers.length === 0) {
    log.info("No users with digest preference found. Exiting.");
    await emailProducerService.disconnect();
    process.exit(0);
  }

  const usersByTenant = digestUsers.reduce<Map<TenantId, DigestUser[]>>(
    (acc, user) => {
      const existing = acc.get(user.tenantId) ?? [];
      return new Map(acc).set(user.tenantId, [...existing, user]);
    },
    new Map()
  );

  const resultsCollector = createResultsCollector();

  for (const [tenantId, users] of usersByTenant) {
    log.info(`Processing tenant ${tenantId} with ${users.length} users`);

    const tenantData = await digestDataService.getDigestDataForTenant(tenantId);

    if (!digestDataService.hasDigestContent(tenantData)) {
      log.info(
        `No digest content for tenant ${tenantId}, skipping all tenant users`
      );
      resultsCollector.addMany(users.map(() => "skipped"));
      continue;
    }

    for (const user of users) {
      const visibility = getVisibleSections(user.userRoles);

      if (!hasVisibleDigestContent(tenantData, visibility)) {
        log.info(
          `No visible digest content for user ${
            user.userId
          } with roles [${user.userRoles.join(
            ","
          )}] in tenant ${tenantId}, skipping`
        );
        resultsCollector.add("skipped");
        continue;
      }

      const emailBody = templateService.compileDigestEmail(
        tenantData,
        visibility
      );

      const result = await processUserWithTenantData(
        user,
        tenantData,
        emailBody,
        log,
        trackingService,
        emailProducerService,
        correlationId,
        config.digestFrequencyHours
      );
      resultsCollector.add(result);
    }
  }

  const { processed, skipped, errors } = resultsCollector.getStats();

  log.info(
    `Email Notification Digest job completed. Processed: ${processed}, Skipped: ${skipped}, Errors: ${errors}`
  );
} catch (error) {
  // Error outside user loop: crash the service
  log.error(`Email Notification Digest job failed: ${error}`);
  await emailProducerService.disconnect();
  process.exit(1);
}

await emailProducerService.disconnect();
process.exit(0);
