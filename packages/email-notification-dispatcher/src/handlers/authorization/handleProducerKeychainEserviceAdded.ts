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
} from "../../services/utils.js";
import { ReadModelServiceSQL } from "../../services/readModelServiceSQL.js";
import { getUserEmailsToNotify } from "../handlerCommons.js";
import { UserServiceSQL } from "../../services/userServiceSQL.js";
import { eServiceNotFound } from "../../models/errors.js";

const notificationType: NotificationType =
  "purposeSuspendedUnsuspendedToConsumer";

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

  const [htmlTemplate, agreements, descriptor] = await Promise.all([
    retrieveHTMLTemplate(
      eventMailTemplateType.producerKeychainEserviceAddedMailTemplate
    ),
    readModelService.getAgreementsByEserviceId(eservice.id),
    retrieveLatestPublishedDescriptor(eservice),
  ]);

  if (!agreements || agreements.length === 0) {
    logger.warn(
      `Agreement not found for eservice ${eservice.id}, skipping email`
    );
    return [];
  }

  const userEmails = (
    await Promise.all(
      agreements.map((agreement) =>
        getUserEmailsToNotify(
          agreement.consumerId,
          notificationType,
          readModelService,
          userService
        )
      )
    )
  ).flat();

  return userEmails.map((email) => ({
    correlationId: correlationId ?? generateId(),
    email: {
      subject: `Nuovo livello di sicurezza per "${eservice.name}"`,
      body: templateService.compileHtml(htmlTemplate, {
        title: `Nuovo livello di sicurezza per "${eservice.name}"`,
        notificationType,
        entityId: descriptor.id,
        eserviceName: eservice.name,
      }),
    },
    address: email,
  }));
}
