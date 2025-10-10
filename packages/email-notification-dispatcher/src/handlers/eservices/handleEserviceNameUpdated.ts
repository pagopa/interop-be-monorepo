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
  EServiceNameUpdatedHandlerParams,
  getRecipientsForTenants,
} from "../handlerCommons.js";

const notificationType: NotificationType = "eserviceStateChangedToConsumer";

export async function handleEserviceNameUpdated(
  data: EServiceNameUpdatedHandlerParams
): Promise<EmailNotificationMessagePayload[]> {
  const {
    eserviceV2Msg,
    oldName,
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

  return targets.flatMap(({ address, tenantId }) => {
    const oldEserviceName = oldName ?? eservice.id;
    const tenant = tenants.find((tenant) => tenant.id === tenantId);

    if (!tenant) {
      return [];
    }

    return [
      {
        correlationId: correlationId ?? generateId(),
        email: {
          subject: `L'e-service ${oldEserviceName} è stato rinominato`,
          body: templateService.compileHtml(htmlTemplate, {
            title: `L'e-service ${oldEserviceName} è stato rinominato`,
            notificationType,
            entityId: eservice.id,
            consumerName: tenant.name,
            oldEserviceName,
            newEserviceName: eservice.name,
          }),
        },
        address,
      },
    ];
  });
}
