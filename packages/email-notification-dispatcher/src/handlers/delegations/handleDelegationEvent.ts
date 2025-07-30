import {
  CorrelationId,
  EmailNotificationMessagePayload,
  DelegationEventEnvelopeV2,
} from "pagopa-interop-models";
import { HtmlTemplateService, Logger } from "pagopa-interop-commons";
import { P, match } from "ts-pattern";
import { ReadModelServiceSQL } from "../../services/readModelServiceSQL.js";

// const interopFeBaseUrl = config.interopFeBaseUrl;

export async function handleDelegationEvent(
  decodedMessage: DelegationEventEnvelopeV2,
  _correlationId: CorrelationId,
  logger: Logger,
  _readModelService: ReadModelServiceSQL,
  _templateService: HtmlTemplateService
): Promise<EmailNotificationMessagePayload[]> {
  return match(decodedMessage)
    .with(
      {
        type: P.union(
          "ProducerDelegationSubmitted",
          "ProducerDelegationApproved",
          "ProducerDelegationRejected",
          "ProducerDelegationRevoked",
          "ConsumerDelegationSubmitted",
          "ConsumerDelegationApproved",
          "ConsumerDelegationRejected",
          "ConsumerDelegationRevoked"
        ),
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
