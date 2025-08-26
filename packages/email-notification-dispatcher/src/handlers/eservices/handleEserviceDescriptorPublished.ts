import { getLatestTenantMailOfKind } from "pagopa-interop-commons";
import {
  fromEServiceV2,
  tenantMailKind,
  EmailNotificationMessagePayload,
  generateId,
  missingKafkaMessageDataError,
  NotificationType,
} from "pagopa-interop-models";
import {
  eventMailTemplateType,
  retrieveHTMLTemplate,
  retrieveLatestPublishedDescriptor,
  retrieveTenant,
} from "../../services/utils.js";
import { EServiceHandlerParams } from "../handlerCommons.js";

const notificationType: NotificationType =
  "purposeSuspendedUnsuspendedToConsumer";

export async function handleEserviceDescriptorPublished(
  data: EServiceHandlerParams
): Promise<EmailNotificationMessagePayload[]> {
  const {
    eserviceV2Msg,
    readModelService,
    logger,
    templateService,
    correlationId,
  } = data;

  if (!eserviceV2Msg) {
    throw missingKafkaMessageDataError(
      "eservice",
      "EServiceDescriptorPublished"
    );
  }

  const eservice = fromEServiceV2(eserviceV2Msg);

  const [htmlTemplate, agreements, descriptor] = await Promise.all([
    retrieveHTMLTemplate(
      eventMailTemplateType.eserviceDescriptorPublishedMailTemplate
    ),
    readModelService.getAgreementsByEserviceId(eservice.id),
    retrieveLatestPublishedDescriptor(eservice),
  ]);

  if (!agreements || agreements.length === 0) {
    logger.warn(
      `Agreement not found for eservice ${eservice.id}, skipping email`
    );
  }

  const consumers = await Promise.all(
    (agreements ?? []).map((consumer) =>
      retrieveTenant(consumer.consumerId, readModelService)
    )
  );

  return (
    consumers
      .flatMap((consumer) => {
        const email = getLatestTenantMailOfKind(
          consumer.mails,
          tenantMailKind.ContactEmail
        );
        if (!email) {
          logger.warn(
            `Consumer email not found for consumer ${consumer.id}, skipping email`
          );
          return [];
        }
        return [email];
      })
      // Map to message payload
      .map((consumerEmail) => ({
        correlationId: correlationId ?? generateId(),
        email: {
          subject: `Nuova versione dell'eservice ${eservice.name} da parte dell'erogatore`,
          body: templateService.compileHtml(htmlTemplate, {
            title: "Nuova versione di un e-service",
            notificationType,
            entityId: descriptor.id,
            eserviceName: eservice.name,
          }),
        },
        address: consumerEmail.address,
      }))
  );
}
