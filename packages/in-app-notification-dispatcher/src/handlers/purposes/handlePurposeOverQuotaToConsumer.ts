import {
  fromPurposeV2,
  missingKafkaMessageDataError,
  PurposeV2,
  NewNotification,
} from "pagopa-interop-models";
import { Logger } from "pagopa-interop-commons";
import { ReadModelServiceSQL } from "../../services/readModelServiceSQL.js";
import {
  getNotificationRecipients,
  retrieveEservice,
  retrieveLatestPublishedDescriptor,
} from "../handlerCommons.js";
import { inAppTemplates } from "../../templates/inAppTemplates.js";

export type PurposeOverQuotaToConsumerType =
  | "NewPurposeVersionWaitingForApproval"
  | "PurposeWaitingForApproval";

export async function handlePurposeOverQuotaToConsumer(
  purposeV2Msg: PurposeV2 | undefined,
  logger: Logger,
  readModelService: ReadModelServiceSQL,
  type: PurposeOverQuotaToConsumerType
): Promise<NewNotification[]> {
  if (!purposeV2Msg) {
    throw missingKafkaMessageDataError("purpose", type);
  }
  logger.info(
    `Sending in-app notification for handlePurposeOverQuotaToConsumer ${purposeV2Msg.id}`
  );
  const purpose = fromPurposeV2(purposeV2Msg);
  const eservice = await retrieveEservice(purpose.eserviceId, readModelService);
  const { dailyCallsPerConsumer } = retrieveLatestPublishedDescriptor(eservice);

  const usersWithNotifications = await getNotificationRecipients(
    [purpose.consumerId],
    "purposeOverQuotaStateToConsumer",
    readModelService,
    logger
  );
  if (usersWithNotifications.length === 0) {
    logger.info(
      `No users with notifications enabled for ${type} purpose ${purpose.id}`
    );
    return [];
  }

  const body = inAppTemplates.purposeOverQuotaToConsumer(
    eservice.name,
    dailyCallsPerConsumer
  );

  return usersWithNotifications.map(({ userId, tenantId }) => ({
    userId,
    tenantId,
    body,
    notificationType: "purposeOverQuotaStateToConsumer",
    entityId: purpose.id,
  }));
}
