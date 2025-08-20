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

export type EServiceNameUpdatedData = {
  eserviceV2Msg?: EServiceV2;
  readModelService: ReadModelServiceSQL;
  logger: Logger;
  templateService: HtmlTemplateService;
  userService: UserServiceSQL;
  correlationId: CorrelationId;
};

// Very tenative implementation. EServiceNameUpdated does not contain the old name for now
export async function handleEserviceNameUpdated(
  data: EServiceNameUpdatedData
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
      subject: `L'e-service <Vecchio Nome E-service> è stato rinominato`,
      body: templateService.compileHtml(htmlTemplate, {
        title: "Nome di un e-service modificato",
        notificationType,
        entityId: descriptor.id,
        eserviceName: eservice.name,
      }),
    },
    address: email,
  }));
}
