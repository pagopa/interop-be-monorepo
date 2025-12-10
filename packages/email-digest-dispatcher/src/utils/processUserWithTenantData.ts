import { Logger } from "pagopa-interop-commons";
import { CorrelationId } from "pagopa-interop-models";
import { TenantDigestData } from "../services/digestDataService.js";
import { DigestUser } from "../services/readModelService.js";
import { DigestTrackingService } from "../services/digestTrackingService.js";
import {
  createDigestEmailPayload,
  EmailProducerService,
} from "../services/emailProducerService.js";
import { ProcessResult } from "./resultsCollector.js";

export const processUserWithTenantData = async (
  user: DigestUser,
  tenantData: TenantDigestData,
  emailBody: string,
  log: Logger,
  trackingService: DigestTrackingService,
  emailProducerService: EmailProducerService,
  correlationId: CorrelationId,
  digestFrequencyDays: number
  // eslint-disable-next-line max-params
): Promise<ProcessResult> => {
  try {
    log.info(
      `Processing digest for user ${user.userId} of tenant ${user.tenantId}`
    );

    const hasReceivedRecently = await trackingService.hasReceivedDigestRecently(
      user.userId,
      user.tenantId,
      digestFrequencyDays
    );

    if (hasReceivedRecently) {
      log.info(
        `User ${user.userId} already received digest in last ${digestFrequencyDays} days, skipping`
      );
      return "skipped";
    }

    const payload = createDigestEmailPayload(
      user.userId,
      tenantData.tenantId,
      emailBody,
      correlationId
    );

    await trackingService.recordDigestSent(user.userId, user.tenantId);

    await emailProducerService.sendDigestEmail(payload, log);

    log.info(`Successfully processed digest for user ${user.userId}`);
    return "processed";
  } catch (userError) {
    // Per-user error: log and continue to next user
    // No DB write happened = user will be retried next run unless it's a kafka error but in that case no email will be sent
    log.error(
      `Error processing digest for user ${user.userId} of tenant ${user.tenantId}: ${userError}`
    );
    return "error";
  }
};
