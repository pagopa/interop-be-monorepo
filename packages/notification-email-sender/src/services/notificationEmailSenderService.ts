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
  TenantMail,
  fromAgreementV2,
  fromEServiceV2,
  fromPurposeV2,
  genericInternalError,
  tenantMailKind,
  unsafeBrandId,
} from "pagopa-interop-models";
import { z } from "zod";
import { match } from "ts-pattern";
import {
  agreementStampDateNotFound,
  descriptorInValidStateNotFound,
  descriptorNotFound,
  eserviceAgreementsNotFound,
  eServiceNotFound,
  htmlTemplateNotFound,
  tenantDigitalAddressNotFound,
  tenantNotFound,
} from "../models/errors.js";
import { ReadModelService } from "./readModelService.js";

// Be careful to change this enum, it's used to find the html template files
export const eventMailTemplateType = {
  activation: "activation-mail",
  submission: "submission-mail",
  rejection: "rejection-mail",
  newPurposeVersionWaitingForApprovalMailTemplate:
    "new-purpose-version-waiting-for-approval-mail",
  purposeVersionRejected: "purpose-version-rejected-mail",
  eserviceDescriptorPublishedMailTemplate: "eservice-descriptor-published-mail",
} as const;

const EventMailTemplateType = z.enum([
  Object.values(eventMailTemplateType)[0],
  ...Object.values(eventMailTemplateType).slice(1),
]);

type EventMailTemplateType = z.infer<typeof EventMailTemplateType>;

export const retrieveTenantMailAddress = (tenant: Tenant): TenantMail => {
  const digitalAddress = getLatestTenantMailOfKind(
    tenant.mails,
    tenantMailKind.ContactEmail
  );
  if (!digitalAddress) {
    throw tenantDigitalAddressNotFound(tenant.id);
  }
  return digitalAddress;
};

async function retrieveAgreementEservice(
  agreement: Agreement,
  readModelService: ReadModelService
): Promise<EService> {
  const eservice = await readModelService.getEServiceById(agreement.eserviceId);

  if (!eservice) {
    throw eServiceNotFound(agreement.eserviceId);
  }

  return eservice;
}

async function retrieveTenant(
  tenantId: TenantId,
  readModelService: ReadModelService
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

export const retrieveEService = async (
  eserviceId: EServiceId,
  readModelService: ReadModelService
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

export const retrieveEserviceAgreements = async (
  eserviceId: EServiceId,
  readModelService: ReadModelService
): Promise<Agreement[]> => {
  const agreements = await readModelService.getAgreementsByEserviceId(
    eserviceId
  );
  if (!agreements) {
    throw eserviceAgreementsNotFound(eserviceId);
  }
  return agreements;
};

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

const isValidDescriptorState = (d: Descriptor): boolean =>
  match(d.state)
    .with("Archived", "Deprecated", "Published", "Suspended", () => true)
    .with("Draft", "WaitingForApproval", () => false)
    .exhaustive();

function getLatestValidDescriptor(eservice: EService): Descriptor {
  const latestDescriptor = eservice.descriptors
    .filter(isValidDescriptorState)
    .sort((a, b) => Number(a.version) - Number(b.version))
    .at(-1);
  if (!latestDescriptor) {
    throw descriptorInValidStateNotFound(eservice.id);
  }
  return latestDescriptor;
}

async function sendActivationNotificationEmail(
  emailManager: EmailManagerSES,
  readModelService: ReadModelService,
  agreementV2Msg: AgreementV2,
  templateService: HtmlTemplateService,
  templateKind: EventMailTemplateType,
  logger: Logger,
  sender: { label: string; mail: string },
  consumerName: string,
  producerName: string,
  recipientsEmails: string[],
  interopFeUrl?: string
): Promise<void> {
  const agreement = fromAgreementV2(agreementV2Msg);
  const htmlTemplate = await retrieveHTMLTemplate(templateKind);

  const activationDate = getFormattedAgreementStampDate(
    agreement,
    "activation"
  );

  const eservice = await retrieveAgreementEservice(agreement, readModelService);
  const descriptor = retrieveAgreementDescriptor(eservice, agreement);
  const mail = {
    subject: `Richiesta di fruizione ${agreement.id} attiva`,
    to: recipientsEmails,
    body: templateService.compileHtml(htmlTemplate, {
      activationDate,
      agreementId: agreement.id,
      eserviceName: eservice.name,
      eserviceVersion: descriptor.version,
      producerName,
      consumerName,
      interopFeUrl,
    }),
  };
  try {
    logger.info(
      `Sending email for agreement ${agreement.id} activation (${emailManager.kind})`
    );
    await emailManager.send(
      { name: sender.label, address: sender.mail },
      mail.to,
      mail.subject,
      mail.body
    );
    logger.info(
      `Email sent for agreement ${agreement.id} activation (${emailManager.kind})`
    );
  } catch (err) {
    logger.error(
      `Unexpected error sending email for agreement ${agreement.id} activation (${emailManager.kind}): ${err}`
    );
    throw genericInternalError(
      `Error sending email for agreement ${agreement.id}: ${err}`
    );
  }
}

export function notificationEmailSenderServiceBuilder(
  sesEmailManager: EmailManagerSES,
  sesSenderData: { label: string; mail: string },
  readModelService: ReadModelService,
  templateService: HtmlTemplateService,
  interopFeBaseUrl?: string
) {
  return {
    sendSubmissionNotificationSimpleEmail: async (
      agreementV2Msg: AgreementV2,
      logger: Logger
    ): Promise<void> => {
      const agreement = fromAgreementV2(agreementV2Msg);

      const [htmlTemplate, eservice, producer, consumer] = await Promise.all([
        retrieveHTMLTemplate(eventMailTemplateType.submission),
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

      const mail = {
        from: { name: sesSenderData.label, address: sesSenderData.mail },
        subject: `Nuova richiesta di fruizione per ${eservice.name} ricevuta`,
        to: [producerEmail.address],
        body: templateService.compileHtml(htmlTemplate, {
          interopFeUrl: `https://${interopFeBaseUrl}/ui/it/erogazione/richieste/${agreement.id}`,
          producerName: producer.name,
          consumerName: consumer.name,
          eserviceName: eservice.name,
          submissionDate,
        }),
      };

      try {
        logger.info(
          `Sending email for agreement ${agreement.id} submission (SES)`
        );
        await sesEmailManager.send(mail.from, mail.to, mail.subject, mail.body);
        logger.info(
          `Email sent for agreement ${agreement.id} submission (SES)`
        );
      } catch (err) {
        logger.warn(
          `Error sending email for agreement ${agreement.id}: ${err}`
        );
        throw genericInternalError(
          `Error sending email for agreement ${agreement.id}: ${err}`
        );
      }
    },
    sendActivationNotificationSimpleEmail: async (
      agreementV2Msg: AgreementV2,
      logger: Logger
    ) => {
      const consumer = await retrieveTenant(
        unsafeBrandId(agreementV2Msg.consumerId),
        readModelService
      );
      const producer = await retrieveTenant(
        unsafeBrandId(agreementV2Msg.producerId),
        readModelService
      );

      const recepientsEmails = [retrieveTenantMailAddress(consumer).address];

      return sendActivationNotificationEmail(
        sesEmailManager,
        readModelService,
        agreementV2Msg,
        templateService,
        eventMailTemplateType.activation,
        logger,
        sesSenderData,
        consumer.name,
        producer.name,
        recepientsEmails,
        interopFeBaseUrl
      );
    },
    sendRejectNotificationSimpleEmail: async (
      agreementV2Msg: AgreementV2,
      logger: Logger
    ) => {
      const agreement = fromAgreementV2(agreementV2Msg);

      const [htmlTemplate, eservice, producer, consumer] = await Promise.all([
        retrieveHTMLTemplate(eventMailTemplateType.rejection),
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

      const mail = {
        from: { name: sesSenderData.label, address: sesSenderData.mail },
        subject: `Richiesta di fruizione per ${eservice.name} rifiutata`,
        to: [consumerEmail.address],
        body: templateService.compileHtml(htmlTemplate, {
          interopFeUrl: `https://${interopFeBaseUrl}/ui/it/erogazione/richieste/${agreement.id}`,
          producerName: producer.name,
          consumerName: consumer.name,
          eserviceName: eservice.name,
          rejectionDate,
        }),
      };

      try {
        logger.info(
          `Sending email for agreement ${agreement.id} rejection (SES)`
        );
        await sesEmailManager.send(mail.from, mail.to, mail.subject, mail.body);
        logger.info(`Email sent for agreement ${agreement.id} rejection (SES)`);
      } catch (err) {
        logger.warn(
          `Error sending email for agreement ${agreement.id}: ${err}`
        );
        throw genericInternalError(
          `Error sending email for agreement ${agreement.id}: ${err}`
        );
      }
    },
    sendEstimateAboveTheThresholderNotificationSimpleEmail: async (
      purposeV2Msg: PurposeV2,
      logger: Logger
    ) => {
      const purpose = fromPurposeV2(purposeV2Msg);

      const [htmlTemplate, eservice, consumer] = await Promise.all([
        retrieveHTMLTemplate(
          eventMailTemplateType.newPurposeVersionWaitingForApprovalMailTemplate
        ),
        retrieveEService(purpose.eserviceId, readModelService),
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

      const mail = {
        from: { name: sesSenderData.label, address: sesSenderData.mail },
        subject: `Richiesta di variazione della stima di carico per ${eservice.name}`,
        to: [consumerEmail.address],
        body: templateService.compileHtml(htmlTemplate, {
          interopFeUrl: `https://${interopFeBaseUrl}/ui/it/erogazione/finalita/${purpose.id}`,
          purposeName: purpose.title,
          eserviceName: eservice.name,
        }),
      };

      try {
        logger.info(
          `Sending an email requesting a change in the load estimate as it is above the threshold, for purpose ${purpose.id} (SES)`
        );
        await sesEmailManager.send(mail.from, mail.to, mail.subject, mail.body);
        logger.info(
          `Email sent for requesting  a change in the load estimate as it is above the threshold, for purpose ${purpose.id} (SES)`
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

      const [htmlTemplate, consumer] = await Promise.all([
        retrieveHTMLTemplate(eventMailTemplateType.purposeVersionRejected),
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

      const mail = {
        from: { name: sesSenderData.label, address: sesSenderData.mail },
        subject: `Rifiuto delle finalità da parte dell'erogatore`,
        to: [consumerEmail.address],
        body: templateService.compileHtml(htmlTemplate, {
          interopFeUrl: `https://${interopFeBaseUrl}/ui/it/erogazione/finalita/${purpose.id}`,
          consumerName: consumer.name,
        }),
      };

      try {
        logger.info(
          `Sending an email for purpose ${purpose.id} rejection (SES)`
        );
        await sesEmailManager.send(mail.from, mail.to, mail.subject, mail.body);
        logger.info(`Email sent for purpose ${purpose.id} rejection (SES)`);
      } catch (err) {
        logger.warn(
          `Error sending email for purpose ${purpose.id} rejection: ${err}`
        );
        throw genericInternalError(
          `Error sending email for purpose ${purpose.id} rejection: ${err}`
        );
      }
    },
    sendEserviceDescriptorPublishedSimpleEmail: async (
      eserviceV2Msg: EServiceV2,
      logger: Logger
    ) => {
      const eservice = fromEServiceV2(eserviceV2Msg);

      const [htmlTemplate] = await Promise.all([
        retrieveHTMLTemplate(
          eventMailTemplateType.eserviceDescriptorPublishedMailTemplate
        ),
      ]);

      const agreements: Agreement[] = await retrieveEserviceAgreements(
        eservice.id,
        readModelService
      );

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
          return;
        }

        const descriptor = getLatestValidDescriptor(eservice);

        const mail = {
          from: { name: sesSenderData.label, address: sesSenderData.mail },
          subject: `Nuova versione dell'eservice ${eservice.name} da parte dell'erogatore`,
          to: [consumerEmail.address],
          body: templateService.compileHtml(htmlTemplate, {
            interopFeUrl: `https://${interopFeBaseUrl}/ui/it/erogazione/fruizione/catalogo-e-service/${eservice.id}/${descriptor}`,
            eserviceName: eservice.name,
          }),
        };

        try {
          logger.info(
            `Sending an email for eservice ${eservice.id} rejection (SES)`
          );
          await sesEmailManager.send(
            mail.from,
            mail.to,
            mail.subject,
            mail.body
          );
          logger.info(`Email sent for eservice ${eservice.id} rejection (SES)`);
        } catch (err) {
          logger.warn(
            `Error sending email for eservice ${eservice.id} rejection: ${err}`
          );
          throw genericInternalError(
            `Error sending email for eservice ${eservice.id} rejection: ${err}`
          );
        }
      }
    },
  };
}
