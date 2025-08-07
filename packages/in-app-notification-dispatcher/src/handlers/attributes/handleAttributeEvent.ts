import { AttributeEventEnvelope, Notification } from "pagopa-interop-models";
import { Logger } from "pagopa-interop-commons";
import { P, match } from "ts-pattern";
import { ReadModelServiceSQL } from "../../services/readModelServiceSQL.js";

export async function handleAttributeEvent(
  decodedMessage: AttributeEventEnvelope,
  logger: Logger,
  _readModelService: ReadModelServiceSQL
): Promise<Notification[]> {
  return match(decodedMessage)
    .with(
      {
        type: P.union("AttributeAdded", "MaintenanceAttributeDeleted"),
      },
      () => {
        logger.info(
          `No need to send an in-app notification for ${decodedMessage.type} message`
        );
        return [];
      }
    )
    .exhaustive();
}
