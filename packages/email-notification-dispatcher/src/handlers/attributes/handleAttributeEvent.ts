import {
  AttributeEvent,
  EmailNotificationMessagePayload,
} from "pagopa-interop-models";
import { P, match } from "ts-pattern";
import { HandlerParams } from "../../models/handlerParams.js";

// const interopFeBaseUrl = config.interopFeBaseUrl;

export async function handleAttributeEvent(
  params: HandlerParams<typeof AttributeEvent>
): Promise<EmailNotificationMessagePayload[]> {
  const {
    decodedMessage,
    logger,
    // readModelService,
    // templateService,
    // userService,
    // correlationId,
  } = params;
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
