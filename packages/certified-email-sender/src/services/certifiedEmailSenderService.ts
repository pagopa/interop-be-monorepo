/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable max-params */
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import {
  EmailManagerPEC,
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
  Tenant,
  TenantId,
  TenantMail,
  fromAgreementV2,
  genericInternalError,
  tenantMailKind,
  unsafeBrandId,
} from "pagopa-interop-models";
import { z } from "zod";
import Mail from "nodemailer/lib/mailer/index.js";
import {
  agreementStampDateNotFound,
  descriptorNotFound,
  eServiceNotFound,
  htmlTemplateNotFound,
  tenantDigitalAddressNotFound,
  tenantNotFound,
} from "../models/errors.js";
import { ReadModelServiceSQL } from "./readModelServiceSQL.js";

// Be careful to change this enum, it's used to find the html template files
export const certifiedMailTemplateEventType = {
  agreementActivationPEC: "agreement-activation-pec-mail",
} as const;

const CertifiedMailTemplateEventType = z.enum([
  Object.values(certifiedMailTemplateEventType)[0],
  ...Object.values(certifiedMailTemplateEventType).slice(1),
]);

type CertifiedMailTemplateEventType = z.infer<
  typeof CertifiedMailTemplateEventType
>;

const retrieveTenantDigitalAddress = (tenant: Tenant): TenantMail => {
  const digitalAddress = getLatestTenantMailOfKind(
    tenant.mails,
    tenantMailKind.DigitalAddress
  );
  if (!digitalAddress) {
    throw tenantDigitalAddressNotFound(tenant.id);
  }
  return digitalAddress;
};

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

async function retrieveHTMLTemplate(
  templateKind: CertifiedMailTemplateEventType
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

export function certifiedEmailSenderServiceBuilder(
  pecEmailManager: EmailManagerPEC,
  pecSenderData: { label: string; mail: string },
  readModelService: ReadModelServiceSQL,
  templateService: HtmlTemplateService
) {
  return {
    sendAgreementActivatedCertifiedEmail: async (
      agreementV2Msg: AgreementV2,
      logger: Logger
    ) => {
      const agreement = fromAgreementV2(agreementV2Msg);

      const [consumer, producer, htmlTemplate, eservice] = await Promise.all([
        retrieveTenant(
          unsafeBrandId(agreementV2Msg.consumerId),
          readModelService
        ),
        retrieveTenant(
          unsafeBrandId(agreementV2Msg.producerId),
          readModelService
        ),
        retrieveHTMLTemplate(
          certifiedMailTemplateEventType.agreementActivationPEC
        ),
        retrieveAgreementEservice(agreement, readModelService),
      ]);

      const descriptor = retrieveAgreementDescriptor(eservice, agreement);

      const recipientsEmails = [
        retrieveTenantDigitalAddress(consumer).address,
        retrieveTenantDigitalAddress(producer).address,
      ];

      const mailOptions: Mail.Options = {
        from: {
          name: pecSenderData.label,
          address: pecSenderData.mail,
        },
        to: recipientsEmails,
        subject: `Richiesta di fruizione ${agreement.id} attiva`,
        html: templateService.compileHtml(htmlTemplate, {
          activationDate: getFormattedAgreementStampDate(
            agreement,
            "activation"
          ),
          agreementId: agreement.id,
          eserviceName: eservice.name,
          eserviceVersion: descriptor.version,
          producerName: producer.name,
          consumerName: consumer.name,
        }),
      };

      try {
        logger.info(
          `Sending certified email for agreement ${agreement.id} activation`
        );
        await pecEmailManager.send(mailOptions, logger);
        logger.info(
          `Certified email sent for agreement ${agreement.id} activation`
        );
      } catch (err) {
        logger.error(
          `Unexpected error sending certified email for agreement ${agreement.id} activation: ${err}`
        );
        throw genericInternalError(
          `Error sending certified email for agreement ${agreement.id}: ${err}`
        );
      }
    },
  };
}
