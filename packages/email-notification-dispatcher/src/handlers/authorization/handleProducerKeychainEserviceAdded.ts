/* eslint-disable functional/no-let */
import { HtmlTemplateService, Logger } from "pagopa-interop-commons";
import {
  EmailNotificationMessagePayload,
  generateId,
  CorrelationId,
  NotificationType,
  EServiceId,
} from "pagopa-interop-models";
import {
  eventMailTemplateType,
  retrieveHTMLTemplate,
  retrieveLatestPublishedDescriptor,
  retrieveTenant,
} from "../../services/utils.js";
import { ReadModelServiceSQL } from "../../services/readModelServiceSQL.js";
import { getRecipientsForTenants } from "../handlerCommons.js";
import { UserServiceSQL } from "../../services/userServiceSQL.js";
import { eServiceNotFound } from "../../models/errors.js";

const notificationType: NotificationType = "eserviceStateChangedToConsumer";

export type ProductKeychainEServiceAddedData = {
  eserviceId: EServiceId;
  readModelService: ReadModelServiceSQL;
  logger: Logger;
  templateService: HtmlTemplateService;
  userService: UserServiceSQL;
  correlationId: CorrelationId;
};

export async function handleProducerKeychainEserviceAdded(
  data: ProductKeychainEServiceAddedData
): Promise<EmailNotificationMessagePayload[]> {
  const {
    eserviceId,
    readModelService,
    logger,
    templateService,
    userService,
    correlationId,
  } = data;

  const eservice = await readModelService.getEServiceById(eserviceId);

  if (eservice === undefined) {
    throw eServiceNotFound(eserviceId);
  }

  const [htmlTemplate, agreements, descriptor, producer] = await Promise.all([
    retrieveHTMLTemplate(
      eventMailTemplateType.producerKeychainEserviceAddedMailTemplate
    ),
    readModelService.getAgreementsByEserviceId(eservice.id),
    retrieveLatestPublishedDescriptor(eservice),
    retrieveTenant(eservice.producerId, readModelService),
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

  return targets.map(({ address }) => ({
    correlationId: correlationId ?? generateId(),
    email: {
      subject: `Nuovo livello di sicurezza per "${eservice.name}"`,
      body: templateService.compileHtml(htmlTemplate, {
        title: `Nuovo livello di sicurezza per "${eservice.name}"`,
        notificationType,
        entityId: descriptor.id,
        producerName: producer.name,
        eserviceName: eservice.name,
        ctaLabel: `Visualizza chiavi`,
      }),
    },
    address,
  }));
}
