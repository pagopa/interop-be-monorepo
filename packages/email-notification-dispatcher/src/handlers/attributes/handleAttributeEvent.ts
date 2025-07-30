import {
  AttributeEventEnvelope,
  CorrelationId,
  EmailNotificationMessagePayload,
} from "pagopa-interop-models";
import { HtmlTemplateService, Logger } from "pagopa-interop-commons";
import { P, match } from "ts-pattern";
import { ReadModelServiceSQL } from "../../services/readModelServiceSQL.js";

// const interopFeBaseUrl = config.interopFeBaseUrl;

export async function handleAttributeEvent(
  decodedMessage: AttributeEventEnvelope,
  _correlationId: CorrelationId,
  logger: Logger,
  _readModelService: ReadModelServiceSQL,
  _templateService: HtmlTemplateService
): Promise<EmailNotificationMessagePayload[]> {
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
