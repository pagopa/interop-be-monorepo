/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable max-params */
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import {
  EmailManagerSES,
  HtmlTemplateService,
  Logger,
  dateAtRomeZone,
  getLatestTenantMailOfKind,
} from "pagopa-interop-commons";
import {
  Agreement,
  AgreementV2,
  Descriptor,
  EService,
  EServiceId,
  EServiceV2,
  PurposeV2,
  Tenant,
  TenantId,
  descriptorState,
  fromAgreementV2,
  fromEServiceV2,
  fromPurposeV2,
  genericInternalError,
  tenantMailKind,
} from "pagopa-interop-models";
import { z } from "zod";
import { match } from "ts-pattern";
import Mail from "nodemailer/lib/mailer/index.js";
import {
  agreementStampDateNotFound,
  descriptorPublishedNotFound,
  descriptorNotFound,
  eServiceNotFound,
  htmlTemplateNotFound,
  tenantNotFound,
} from "../models/errors.js";
import { ReadModelServiceSQL } from "./readModelServiceSQL.js";

// Be careful to change this enum, it's used to find the html template files
export const eventMailTemplateType = {
  agreementActivatedMailTemplate: "agreement-activated-mail",
  agreementSubmittedMailTemplate: "agreement-submitted-mail",
  agreementRejectedMailTemplate: "agreement-rejected-mail",
  newPurposeVersionWaitingForApprovalMailTemplate:
    "new-purpose-version-waiting-for-approval-mail",
  firstPurposeVersionRejectedMailTemplate:
    "first-purpose-version-rejected-mail",
  otherPurposeVersionRejectedMailTemplate:
    "other-purpose-version-rejected-mail",
  purposeWaitingForApprovalMailTemplate: "purpose-waiting-for-approval-mail",
  eserviceDescriptorPublishedMailTemplate: "eservice-descriptor-published-mail",
  purposeVersionActivatedMailTemplate: "purpose-version-activated-mail",
} as const;

const EventMailTemplateType = z.enum([
  Object.values(eventMailTemplateType)[0],
  ...Object.values(eventMailTemplateType).slice(1),
]);

type EventMailTemplateType = z.infer<typeof EventMailTemplateType>;

async function retrieveAgreementEservice(
  agreement: Agreement,
  readModelService: ReadModelServiceSQL
): Promise<EService> {
  const eservice = await readModelService.getEServiceById(agreement.eserviceId);

  if (!eservice) {
    throw eServiceNotFound(agreement.eserviceId);
  }

  return eservice;
}

async function retrieveTenant(
  tenantId: TenantId,
  readModelService: ReadModelServiceSQL
): Promise<Tenant> {
  const tenant = await readModelService.getTenantById(tenantId);
  if (!tenant) {
    throw tenantNotFound(tenantId);
  }
  return tenant;
}

function retrieveAgreementDescriptor(
  eservice: EService,
  agreement: Agreement
): Descriptor {
  const descriptor = eservice.descriptors.find(
    (d) => d.id === agreement.descriptorId
  );

  if (!descriptor) {
    throw descriptorNotFound(agreement.eserviceId, agreement.descriptorId);
  }
  return descriptor;
}

const retrieveEService = async (
  eserviceId: EServiceId,
  readModelService: ReadModelServiceSQL
): Promise<EService> => {
  const eservice = await readModelService.getEServiceById(eserviceId);
  if (!eservice) {
    throw eServiceNotFound(eserviceId);
  }
  return eservice;
};

async function retrieveHTMLTemplate(
  templateKind: EventMailTemplateType
): Promise<string> {
  const filename = fileURLToPath(import.meta.url);
  const dirname = path.dirname(filename);
  const templatePath = `/resources/templates/${templateKind}.html`;

  try {
    const htmlTemplateBuffer = await fs.readFile(
      `${dirname}/..${templatePath}`
    );
    return htmlTemplateBuffer.toString();
  } catch {
    throw htmlTemplateNotFound(templatePath);
  }
}

export function getFormattedAgreementStampDate(
  agreement: Agreement,
  stamp: keyof Agreement["stamps"]
): string {
  const stampDate = agreement.stamps[stamp]?.when;

  if (stampDate === undefined) {
    throw agreementStampDateNotFound(stamp, agreement.id);
  }
  return dateAtRomeZone(new Date(Number(stampDate)));
}

function retrieveLatestPublishedDescriptor(eservice: EService): Descriptor {
  const latestDescriptor = eservice.descriptors
    .filter((d) => d.state === descriptorState.published)
    .sort((a, b) => Number(a.version) - Number(b.version))
    .at(-1);
  if (!latestDescriptor) {
    throw descriptorPublishedNotFound(eservice.id);
  }
  return latestDescriptor;
}

export function notificationEmailSenderServiceBuilder(
  sesEmailManager: EmailManagerSES,
  sesSenderData: { label: string; mail: string },
  readModelService: ReadModelServiceSQL,
  templateService: HtmlTemplateService,
  interopFeBaseUrl?: string
) {
  return {
    sendAgreementSubmittedEmail: async (
      agreementV2Msg: AgreementV2,
      logger: Logger
    ): Promise<void> => {
      const agreement = fromAgreementV2(agreementV2Msg);

      const [htmlTemplate, eservice, producer, consumer] = await Promise.all([
        retrieveHTMLTemplate(
          eventMailTemplateType.agreementSubmittedMailTemplate
        ),
        retrieveAgreementEservice(agreement, readModelService),
        retrieveTenant(agreement.producerId, readModelService),
        retrieveTenant(agreement.consumerId, readModelService),
      ]);

      const submissionDate = getFormattedAgreementStampDate(
        agreement,
        "submission"
      );

      const producerEmail = getLatestTenantMailOfKind(
        producer.mails,
        tenantMailKind.ContactEmail
      );

      if (!producerEmail) {
        logger.warn(
          `Producer email not found for agreement ${agreement.id}, skipping email`
        );
        return;
      }

      const mailOptions: Mail.Options = {
        from: { name: sesSenderData.label, address: sesSenderData.mail },
        subject: `Nuova richiesta di fruizione per ${eservice.name} ricevuta`,
        to: [producerEmail.address],
        html: templateService.compileHtml(htmlTemplate, {
          interopFeUrl: `https://${interopFeBaseUrl}/ui/it/erogazione/richieste/${agreement.id}`,
          producerName: producer.name,
          consumerName: consumer.name,
          eserviceName: eservice.name,
          submissionDate,
        }),
      };

      try {
        logger.info(`Sending email for agreement ${agreement.id} submission`);
        await sesEmailManager.send(mailOptions, logger);
        logger.info(`Email sent for agreement ${agreement.id} submission`);
      } catch (err) {
        logger.warn(
          `Error sending email for agreement ${agreement.id}: ${err}`
        );
        throw genericInternalError(
          `Error sending email for agreement ${agreement.id}: ${err}`
        );
      }
    },
    sendAgreementActivatedEmail: async (
      agreementV2Msg: AgreementV2,
      logger: Logger
    ) => {
      const agreement = fromAgreementV2(agreementV2Msg);

      const [htmlTemplate, eservice, producer, consumer] = await Promise.all([
        retrieveHTMLTemplate(
          eventMailTemplateType.agreementActivatedMailTemplate
        ),
        retrieveAgreementEservice(agreement, readModelService),
        retrieveTenant(agreement.producerId, readModelService),
        retrieveTenant(agreement.consumerId, readModelService),
      ]);

      const consumerEmail = getLatestTenantMailOfKind(
        consumer.mails,
        tenantMailKind.ContactEmail
      );

      if (!consumerEmail) {
        logger.warn(
          `Consumer email not found for agreement ${agreement.id}, skipping email`
        );
        return;
      }

      const activationDate = getFormattedAgreementStampDate(
        agreement,
        "activation"
      );

      const descriptor = retrieveAgreementDescriptor(eservice, agreement);

      const mailOptions: Mail.Options = {
        from: { name: sesSenderData.label, address: sesSenderData.mail },
        subject: `Richiesta di fruizione ${agreement.id} attiva`,
        to: [consumerEmail.address],
        html: templateService.compileHtml(htmlTemplate, {
          interopFeUrl: `https://${interopFeBaseUrl}/ui/it/fruizione/richieste/${agreement.id}`,
          producerName: producer.name,
          consumerName: consumer.name,
          eserviceName: eservice.name,
          eserviceVersion: descriptor.version,
          activationDate,
        }),
      };
      try {
        logger.info(
          `Sending email for agreement ${agreement.id} activation (${sesEmailManager.kind})`
        );
        await sesEmailManager.send(mailOptions, logger);
        logger.info(
          `Email sent for agreement ${agreement.id} activation (${sesEmailManager.kind})`
        );
      } catch (err) {
        logger.error(
          `Unexpected error sending email for agreement ${agreement.id} activation (${sesEmailManager.kind}): ${err}`
        );
        throw genericInternalError(
          `Error sending email for agreement ${agreement.id}: ${err}`
        );
      }
    },
    sendAgreementRejectedEmail: async (
      agreementV2Msg: AgreementV2,
      logger: Logger
    ) => {
      const agreement = fromAgreementV2(agreementV2Msg);

      const [htmlTemplate, eservice, producer, consumer] = await Promise.all([
        retrieveHTMLTemplate(
          eventMailTemplateType.agreementRejectedMailTemplate
        ),
        retrieveAgreementEservice(agreement, readModelService),
        retrieveTenant(agreement.producerId, readModelService),
        retrieveTenant(agreement.consumerId, readModelService),
      ]);

      const rejectionDate = getFormattedAgreementStampDate(
        agreement,
        "rejection"
      );

      const consumerEmail = getLatestTenantMailOfKind(
        consumer.mails,
        tenantMailKind.ContactEmail
      );

      if (!consumerEmail) {
        logger.warn(
          `Consumer email not found for agreement ${agreement.id}, skipping email`
        );
        return;
      }

      const mailOptions: Mail.Options = {
        from: { name: sesSenderData.label, address: sesSenderData.mail },
        subject: `Richiesta di fruizione per ${eservice.name} rifiutata`,
        to: [consumerEmail.address],
        html: templateService.compileHtml(htmlTemplate, {
          interopFeUrl: `https://${interopFeBaseUrl}/ui/it/fruizione/richieste/${agreement.id}`,
          producerName: producer.name,
          consumerName: consumer.name,
          eserviceName: eservice.name,
          rejectionDate,
        }),
      };

      try {
        logger.info(`Sending email for agreement ${agreement.id} rejection`);
        await sesEmailManager.send(mailOptions, logger);
        logger.info(`Email sent for agreement ${agreement.id} rejection`);
      } catch (err) {
        logger.warn(
          `Error sending email for agreement ${agreement.id} rejection: ${err}`
        );
        throw genericInternalError(
          `Error sending email for agreement ${agreement.id} rejection: ${err}`
        );
      }
    },
    sendNewPurposeVersionWaitingForApprovalEmail: async (
      purposeV2Msg: PurposeV2,
      logger: Logger
    ) => {
      const purpose = fromPurposeV2(purposeV2Msg);

      const [htmlTemplate, eservice] = await Promise.all([
        retrieveHTMLTemplate(
          eventMailTemplateType.newPurposeVersionWaitingForApprovalMailTemplate
        ),
        retrieveEService(purpose.eserviceId, readModelService),
      ]);

      const producer = await retrieveTenant(
        eservice.producerId,
        readModelService
      );

      const producerEmail = getLatestTenantMailOfKind(
        producer.mails,
        tenantMailKind.ContactEmail
      );

      if (!producerEmail) {
        logger.warn(
          `Producer email not found for purpose ${purpose.id}, skipping email`
        );
        return;
      }

      const mailOptions: Mail.Options = {
        from: { name: sesSenderData.label, address: sesSenderData.mail },
        subject: `Richiesta di variazione della stima di carico per ${eservice.name}`,
        to: [producerEmail.address],
        html: templateService.compileHtml(htmlTemplate, {
          interopFeUrl: `https://${interopFeBaseUrl}/ui/it/erogazione/finalita/${purpose.id}`,
          purposeName: purpose.title,
          eserviceName: eservice.name,
        }),
      };

      try {
        logger.info(
          `Sending an email requesting a change in the load estimate as it is above the threshold, for purpose ${purpose.id}`
        );
        await sesEmailManager.send(mailOptions, logger);
        logger.info(
          `Email sent for requesting  a change in the load estimate as it is above the threshold, for purpose ${purpose.id}`
        );
      } catch (err) {
        logger.warn(`Error sending email for purpose ${purpose.id}: ${err}`);
        throw genericInternalError(
          `Error sending email for purpose ${purpose.id}: ${err}`
        );
      }
    },
    sendPurposeWaitingForApprovalEmail: async (
      purposeV2Msg: PurposeV2,
      logger: Logger
    ) => {
      const purpose = fromPurposeV2(purposeV2Msg);

      const [htmlTemplate, eservice] = await Promise.all([
        retrieveHTMLTemplate(
          eventMailTemplateType.purposeWaitingForApprovalMailTemplate
        ),
        retrieveEService(purpose.eserviceId, readModelService),
      ]);

      const producer = await retrieveTenant(
        eservice.producerId,
        readModelService
      );

      const producerEmail = getLatestTenantMailOfKind(
        producer.mails,
        tenantMailKind.ContactEmail
      );

      if (!producerEmail) {
        logger.warn(
          `Producer email not found for purpose ${purpose.id}, skipping email`
        );
        return;
      }

      const mailOptions: Mail.Options = {
        from: { name: sesSenderData.label, address: sesSenderData.mail },
        subject: `Richiesta di attivazione della stima di carico sopra soglia per ${eservice.name}`,
        to: [producerEmail.address],
        html: templateService.compileHtml(htmlTemplate, {
          interopFeUrl: `https://${interopFeBaseUrl}/ui/it/erogazione/finalita/${purpose.id}`,
          eserviceName: eservice.name,
        }),
      };

      try {
        logger.info(
          `Send an email with the request to activate the load estimate since it is higher than the threshold, for the purpose ${purpose.id}`
        );
        await sesEmailManager.send(mailOptions, logger);
        logger.info(
          `Email sent for the request to activate the load estimate since it is higher than the threshold, for the purpose ${purpose.id}`
        );
      } catch (err) {
        logger.warn(`Error sending email for purpose ${purpose.id}: ${err}`);
        throw genericInternalError(
          `Error sending email for purpose ${purpose.id}: ${err}`
        );
      }
    },
    sendPurposeVersionRejectedEmail: async (
      purposeV2Msg: PurposeV2,
      logger: Logger
    ) => {
      const purpose = fromPurposeV2(purposeV2Msg);

      const { subject, templateToRetrieve } = match(purpose.versions.length)
        .with(1, () => ({
          subject: "Rifiuto della finalità da parte dell'erogatore",
          templateToRetrieve:
            eventMailTemplateType.firstPurposeVersionRejectedMailTemplate,
        }))
        .otherwise(() => ({
          subject: "Rifiuto richiesta di adeguamento stime di carico",
          templateToRetrieve:
            eventMailTemplateType.otherPurposeVersionRejectedMailTemplate,
        }));

      const [htmlTemplate, consumer] = await Promise.all([
        retrieveHTMLTemplate(templateToRetrieve),
        retrieveTenant(purpose.consumerId, readModelService),
      ]);

      const consumerEmail = getLatestTenantMailOfKind(
        consumer.mails,
        tenantMailKind.ContactEmail
      );

      if (!consumerEmail) {
        logger.warn(
          `Consumer email not found for purpose ${purpose.id}, skipping email`
        );
        return;
      }

      const mailOptions: Mail.Options = {
        from: { name: sesSenderData.label, address: sesSenderData.mail },
        subject,
        to: [consumerEmail.address],
        html: templateService.compileHtml(htmlTemplate, {
          interopFeUrl: `https://${interopFeBaseUrl}/ui/it/fruizione/finalita/${purpose.id}`,
          purposeName: purpose.title,
        }),
      };

      try {
        logger.info(`Sending an email for purpose ${purpose.id} rejection`);
        await sesEmailManager.send(mailOptions, logger);
        logger.info(`Email sent for purpose ${purpose.id} rejection`);
      } catch (err) {
        logger.warn(
          `Error sending email for purpose ${purpose.id} rejection: ${err}`
        );
        throw genericInternalError(
          `Error sending email for purpose ${purpose.id} rejection: ${err}`
        );
      }
    },
    sendEserviceDescriptorPublishedEmail: async (
      eserviceV2Msg: EServiceV2,
      logger: Logger
    ) => {
      const eservice = fromEServiceV2(eserviceV2Msg);

      const [htmlTemplate, agreements, descriptor] = await Promise.all([
        retrieveHTMLTemplate(
          eventMailTemplateType.eserviceDescriptorPublishedMailTemplate
        ),
        readModelService.getAgreementsByEserviceId(eservice.id),
        retrieveLatestPublishedDescriptor(eservice),
      ]);

      if (agreements && agreements.length > 0) {
        const consumers = await Promise.all(
          agreements.map((consumer) =>
            retrieveTenant(consumer.consumerId, readModelService)
          )
        );

        for (const consumer of consumers) {
          const consumerEmail = getLatestTenantMailOfKind(
            consumer.mails,
            tenantMailKind.ContactEmail
          );

          if (!consumerEmail) {
            logger.warn(
              `Consumer email not found for eservice ${eservice.id}, skipping email`
            );
            continue;
          }

          const mailOptions: Mail.Options = {
            from: { name: sesSenderData.label, address: sesSenderData.mail },
            subject: `Nuova versione dell'eservice ${eservice.name} da parte dell'erogatore`,
            to: [consumerEmail.address],
            html: templateService.compileHtml(htmlTemplate, {
              interopFeUrl: `https://${interopFeBaseUrl}/ui/it/fruizione/catalogo-e-service/${eservice.id}/${descriptor.id}`,
              eserviceName: eservice.name,
            }),
          };

          try {
            logger.info(
              `Sending an email for published descriptor ${descriptor.id} of eservice ${eservice.id}`
            );
            await sesEmailManager.send(mailOptions, logger);
            logger.info(
              `Email sent for published descriptor ${descriptor.id} of eservice ${eservice.id}`
            );
          } catch (err) {
            logger.warn(
              `Error sending email for published descriptor ${descriptor.id} of eservice ${eservice.id}: ${err}`
            );
            throw genericInternalError(
              `Error sending email for published descriptor ${descriptor.id} of eservice ${eservice.id}: ${err}`
            );
          }
        }
      } else {
        logger.warn(
          `Agreement not found for eservice ${eservice.id}, skipping email`
        );
      }
    },
    sendPurposeVersionActivatedEmail: async (
      purposeV2Msg: PurposeV2,
      logger: Logger
    ) => {
      const purpose = fromPurposeV2(purposeV2Msg);

      const [htmlTemplate, consumer] = await Promise.all([
        retrieveHTMLTemplate(
          eventMailTemplateType.purposeVersionActivatedMailTemplate
        ),
        retrieveTenant(purpose.consumerId, readModelService),
      ]);

      const consumerEmail = getLatestTenantMailOfKind(
        consumer.mails,
        tenantMailKind.ContactEmail
      );

      if (!consumerEmail) {
        logger.warn(
          `Consumer email not found for purpose ${purpose.id}, skipping email`
        );
        return;
      }

      const mailOptions: Mail.Options = {
        from: { name: sesSenderData.label, address: sesSenderData.mail },
        subject: `Accettazione richiesta di adeguamento stima di carico`,
        to: [consumerEmail.address],
        html: templateService.compileHtml(htmlTemplate, {
          interopFeUrl: `https://${interopFeBaseUrl}/ui/it/fruizione/finalita/${purpose.id}`,
          purposeName: purpose.title,
        }),
      };

      try {
        logger.info(
          `Sending an email to activate the purpose version,  - Purpose ID: ${purpose.id}`
        );
        await sesEmailManager.send(mailOptions, logger);
        logger.info(
          `Activation email sent for purpose version - Purpose ID: ${purpose.id}`
        );
      } catch (err) {
        logger.warn(
          `Error sending email for the activation of the purpose version,  - Purpose ID: ${purpose.id} error: ${err}`
        );
        throw genericInternalError(
          `Error sending email for the activation of the purpose version,  - Purpose ID: ${purpose.id} error: ${err}`
        );
      }
    },
  };
}

export type NotificationEmailSenderService = ReturnType<
  typeof notificationEmailSenderServiceBuilder
>;
