import { initProducer } from "kafka-iam-auth";
import { buildHTMLTemplateService, logger } from "pagopa-interop-commons";
import {
  CorrelationId,
  generateId,
  TenantId,
  unsafeBrandId,
} from "pagopa-interop-models";
import { makeDrizzleConnection } from "pagopa-interop-readmodel";

import { config } from "./config/config.js";
import { makeDigestTrackingDbConnection } from "./model/digestTrackingDb.js";
import { digestDataServiceBuilder } from "./services/digestDataService.js";
import { digestTrackingServiceBuilder } from "./services/digestTrackingService.js";
import { emailProducerServiceBuilder } from "./services/emailProducerService.js";
import {
  readModelServiceBuilder,
  DigestUser,
} from "./services/readModelService.js";
import { digestTemplateServiceBuilder } from "./services/templateService.js";
import {
  canReceiveReviewerDigest,
  getVisibleSections,
  hasVisibleDigestContent,
} from "./utils/digestAdmittedRoles.js";
import { processUserWithTenantData } from "./utils/processUserWithTenantData.js";
import {
  createResultsCollector,
  ProcessResult,
} from "./utils/resultsCollector.js";

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

/**
 * Builds and sends the reviewer digest for a single user. Data is fetched per
 * user, so a failure is handled here as a per-user error instead of crashing
 * the job.
 */
const processReviewerUser = async (
  user: DigestUser
): Promise<ProcessResult> => {
  try {
    const reviewerData = await digestDataService.getReviewerDigestData(
      user.tenantId,
      user.userId
    );

    if (!digestDataService.hasReviewerDigestContent(reviewerData)) {
      log.info(
        `No reviewer digest content for user ${user.userId} in tenant ${user.tenantId}, skipping`
      );
      return "skipped";
    }

    return await processUserWithTenantData(
      user,
      reviewerData,
      templateService.compileReviewerDigestEmail(reviewerData),
      log,
      trackingService,
      emailProducerService,
      correlationId,
      config.digestFrequencyHours
    );
  } catch (error) {
    log.error(
      `Error retrieving reviewer digest data for user ${user.userId} of tenant ${user.tenantId}: ${error}`
    );
    return "error";
  }
};

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
    const tenantHasContent = digestDataService.hasDigestContent(tenantData);
    const reviewerUsers = users.filter((user) =>
      canReceiveReviewerDigest(user.userRoles)
    );

    if (!tenantHasContent && reviewerUsers.length === 0) {
      log.info(
        `No digest content for tenant ${tenantId}, skipping all tenant users`
      );
      resultsCollector.addMany(users.map(() => "skipped"));
      continue;
    }

    for (const user of users) {
      const visibility = getVisibleSections(user.userRoles);

      // Tenant digest first. The tracking table allows one digest per user and
      // tenant per period, so the reviewer digest is only sent to users that
      // have no visible tenant digest content.
      if (tenantHasContent && hasVisibleDigestContent(tenantData, visibility)) {
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
        continue;
      }

      if (canReceiveReviewerDigest(user.userRoles)) {
        resultsCollector.add(await processReviewerUser(user));
        continue;
      }

      log.info(
        `No visible digest content for user ${
          user.userId
        } with roles [${user.userRoles.join(
          ","
        )}] in tenant ${tenantId}, skipping`
      );
      resultsCollector.add("skipped");
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
