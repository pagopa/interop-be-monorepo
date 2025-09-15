import { Logger } from "pagopa-interop-commons";
import { NewNotification, unsafeBrandId } from "pagopa-interop-models";
import { match } from "ts-pattern";
import { ReadModelServiceSQL } from "../../services/readModelServiceSQL.js";
import {
  retrieveEservice,
  retrievePurpose,
  retrieveTenant,
} from "../handlerCommons.js";
import { inAppTemplates } from "../../templates/inAppTemplates.js";

export async function handleClientAddedRemovedToProducer(
  purposeId: string,
  logger: Logger,
  readModelService: ReadModelServiceSQL,
  type: "ClientPurposeAdded" | "ClientPurposeRemoved"
): Promise<NewNotification[]> {
  logger.info(
    `Sending in-app notification for handleClientAddedRemovedToProducer ${purposeId}`
  );

  const purpose = await retrievePurpose(
    unsafeBrandId(purposeId),
    readModelService
  );

  const eservice = await retrieveEservice(purpose.eserviceId, readModelService);

  const userNotificationConfigs =
    await readModelService.getTenantUsersWithNotificationEnabled(
      [eservice.producerId],
      "clientAddedRemovedToProducer"
    );

  if (userNotificationConfigs.length === 0) {
    logger.info(
      `No users with notifications enabled for ${type} purpose ${purpose.id}`
    );
    return [];
  }

  const consumer = await retrieveTenant(purpose.consumerId, readModelService);

  const body = inAppTemplates.clientAddedRemovedToProducer(
    purpose.title,
    eservice.name,
    consumer.name,
    match(type)
      .with("ClientPurposeAdded", () => "associato" as const)
      .with("ClientPurposeRemoved", () => "disassociato" as const)
      .exhaustive()
  );

  return userNotificationConfigs.map(({ userId, tenantId }) => ({
    userId,
    tenantId,
    body,
    notificationType: "clientAddedRemovedToProducer",
    entityId: purpose.id,
  }));
}
