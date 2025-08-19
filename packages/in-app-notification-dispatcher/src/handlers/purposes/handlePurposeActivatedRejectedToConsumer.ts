import {
  fromPurposeV2,
  missingKafkaMessageDataError,
  PurposeV2,
} from "pagopa-interop-models";
import { Logger } from "pagopa-interop-commons";
import { NewNotification } from "pagopa-interop-models";
import { match } from "ts-pattern";
import { ReadModelServiceSQL } from "../../services/readModelServiceSQL.js";
import { retrieveEservice, retrieveTenant } from "../handlerCommons.js";
import { inAppTemplates } from "../../templates/inAppTemplates.js";

export async function handlePurposeActivatedRejectedToConsumer(
  purposeV2Msg: PurposeV2 | undefined,
  logger: Logger,
  readModelService: ReadModelServiceSQL,
  type: "PurposeVersionActivated" | "PurposeVersionRejected"
): Promise<NewNotification[]> {
  if (!purposeV2Msg) {
    throw missingKafkaMessageDataError("purpose", type);
  }
  logger.info(
    `Sending in-app notification for handlePurposeActivatedRejectedToConsumer ${purposeV2Msg.id}`
  );
  const purpose = fromPurposeV2(purposeV2Msg);

  const userNotificationConfigs =
    await readModelService.getTenantUsersWithNotificationEnabled(
      [purpose.consumerId],
      "purposeActivatedRejectedToConsumer"
    );
  if (userNotificationConfigs.length === 0) {
    logger.info(
      `No users with notifications enabled for ${type} purpose ${purpose.id}`
    );
    return [];
  }

  const eservice = await retrieveEservice(purpose.eserviceId, readModelService);
  const producer = await retrieveTenant(eservice.producerId, readModelService);

  const body = inAppTemplates.purposeActivatedRejectedToConsumer(
    purpose.title,
    producer.name,
    eservice.name,
    match(type)
      .with("PurposeVersionActivated", () => "attivato" as const)
      .with("PurposeVersionRejected", () => "rifiuto" as const)
      .exhaustive()
  );

  return userNotificationConfigs.map(({ userId, tenantId }) => ({
    userId,
    tenantId,
    body,
    notificationType: "purposeActivatedRejectedToConsumer",
    entityId: purpose.id,
  }));
}
