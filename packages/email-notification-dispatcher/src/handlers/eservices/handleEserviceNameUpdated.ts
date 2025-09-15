import {
  fromEServiceV2,
  EmailNotificationMessagePayload,
  generateId,
  missingKafkaMessageDataError,
  NotificationType,
} from "pagopa-interop-models";
import {
  eventMailTemplateType,
  retrieveHTMLTemplate,
} from "../../services/utils.js";
import {
  EServiceHandlerParams,
  getRecipientsForTenants,
} from "../handlerCommons.js";

const notificationType: NotificationType =
  "purposeSuspendedUnsuspendedToConsumer";

export async function handleEserviceNameUpdated(
  data: EServiceHandlerParams
): Promise<EmailNotificationMessagePayload[]> {
  const {
    eserviceV2Msg,
    readModelService,
    logger,
    templateService,
    userService,
    correlationId,
  } = data;

  if (!eserviceV2Msg) {
    throw missingKafkaMessageDataError("eservice", "EServiceNameUpdated");
  }

  const eservice = fromEServiceV2(eserviceV2Msg);

  const [htmlTemplate, agreements] = await Promise.all([
    retrieveHTMLTemplate(eventMailTemplateType.eserviceNameUpdatedMailTemplate),
    readModelService.getAgreementsByEserviceId(eservice.id),
  ]);

  if (!agreements || agreements.length === 0) {
    logger.warn(
      `Agreement not found for eservice ${eservice.id}, skipping email`
    );
    return [];
  }

  const tenants = await readModelService.getTenantsById(
    agreements.map((agreement) => agreement.consumerId)
  );

  const targets = await getRecipientsForTenants({
    tenants,
    notificationType,
    readModelService,
    userService,
    logger,
    includeTenantContactEmails: false,
  });

  if (targets.length === 0) {
    logger.info(
      `No targets found. Eservice ${eservice.id}, no emails to dispatch.`
    );
    return [];
  }

  return targets.map(({ tenantName, address }) => ({
    correlationId: correlationId ?? generateId(),
    email: {
      subject: `L'e-service <Vecchio Nome E-service> è stato rinominato`,
      body: templateService.compileHtml(htmlTemplate, {
        title: `L'e-service <Vecchio Nome E-service> è stato rinominato`,
        notificationType,
        entityId: eservice.id,
        consumerName: tenantName,
        oldEserviceName: "<Vecchio Nome EService>",
        newEserviceName: eservice.name,
      }),
    },
    address,
  }));
}
