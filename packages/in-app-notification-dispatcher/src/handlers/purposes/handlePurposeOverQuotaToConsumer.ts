import { Logger } from "pagopa-interop-commons";
import {
  fromPurposeV2,
  missingKafkaMessageDataError,
  PurposeV2,
  purposeVersionState,
  NewNotification,
} from "pagopa-interop-models";
import {
  getNotificationRecipients,
  retrieveEservice,
  inAppTemplates,
} from "pagopa-interop-notification-commons";

import { ReadModelServiceSQL } from "../../services/readModelServiceSQL.js";

type PurposeOverQuotaToConsumerType =
  | "NewPurposeVersionWaitingForApproval"
  | "PurposeWaitingForApproval"
  | "PurposeVersionOverQuotaUnsuspended";

export async function handlePurposeOverQuotaToConsumer(
  purposeV2Msg: PurposeV2 | undefined,
  logger: Logger,
  readModelService: ReadModelServiceSQL,
  type: PurposeOverQuotaToConsumerType,
  versionId?: string
): Promise<NewNotification[]> {
  if (!purposeV2Msg) {
    throw missingKafkaMessageDataError("purpose", type);
  }
  const purpose = fromPurposeV2(purposeV2Msg);
  const version = purpose.versions.find((v) =>
    versionId
      ? v.id === versionId
      : v.state === purposeVersionState.waitingForApproval
  );
  const reason = version?.waitingForApprovalReason;
  if (!reason) {
    logger.warn(
      `Expected waitingForApprovalReason was not found; skipping consumer quota notification - purposeId: ${purpose.id}, versionId: ${version?.id ?? versionId ?? "unknown"}, eventType: ${type}`
    );
    return [];
  }

  logger.info(
    `Sending in-app notification for handlePurposeOverQuotaToConsumer - entityId: ${purposeV2Msg.id}, eventType: ${type}`
  );
  const eservice = await retrieveEservice(purpose.eserviceId, readModelService);

  const usersWithNotifications = await getNotificationRecipients(
    [purpose.consumerId],
    "purposeOverQuotaStateToConsumer",
    readModelService,
    logger
  );
  if (usersWithNotifications.length === 0) {
    logger.info(
      `No users with notifications enabled for handlePurposeOverQuotaToConsumer - entityId: ${purpose.id}, eventType: ${type}`
    );
    return [];
  }

  const body = inAppTemplates.purposeOverQuotaToConsumer(
    eservice.name,
    purpose.title,
    reason
  );

  return usersWithNotifications.map(({ userId, tenantId }) => ({
    userId,
    tenantId,
    body,
    notificationType: "purposeOverQuotaStateToConsumer",
    entityId: purpose.id,
  }));
}
