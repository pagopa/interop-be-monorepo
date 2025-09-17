/* eslint-disable functional/no-let */
import { HtmlTemplateService, Logger } from "pagopa-interop-commons";
import {
  EServiceV2,
  fromEServiceV2,
  EmailNotificationMessagePayload,
  generateId,
  CorrelationId,
  missingKafkaMessageDataError,
  NotificationType,
} from "pagopa-interop-models";
import {
  eventMailTemplateType,
  retrieveHTMLTemplate,
  retrieveLatestPublishedDescriptor,
} from "../../services/utils.js";
import { ReadModelServiceSQL } from "../../services/readModelServiceSQL.js";
import { getUserEmailsToNotify } from "../handlerCommons.js";
import { UserServiceSQL } from "../../services/userServiceSQL.js";

const notificationType: NotificationType =
  "purposeSuspendedUnsuspendedToConsumer";

export type EServiceDescriptorSuspendedData = {
  eserviceV2Msg?: EServiceV2;
  readModelService: ReadModelServiceSQL;
  logger: Logger;
  templateService: HtmlTemplateService;
  userService: UserServiceSQL;
  correlationId: CorrelationId;
};

export async function handleEserviceDescriptorSuspended(
  data: EServiceDescriptorSuspendedData
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
    throw missingKafkaMessageDataError(
      "eservice",
      "EServiceDescriptorSuspended"
    );
  }

  const eservice = fromEServiceV2(eserviceV2Msg);

  const [htmlTemplate, agreements, descriptor] = await Promise.all([
    retrieveHTMLTemplate(
      eventMailTemplateType.eserviceDescriptorSuspendedMailTemplate
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
      subject: `Una versione di ${eservice.name} è stata sospesa`,
      body: templateService.compileHtml(htmlTemplate, {
        title: "Versione di un e-service sospesa",
        notificationType,
        entityId: descriptor.id,
        eserviceName: eservice.name,
      }),
    },
    address: email,
  }));
}
