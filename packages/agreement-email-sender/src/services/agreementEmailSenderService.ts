import { fileURLToPath } from "url";
import path from "path";
import fs from "fs/promises";
import {
  AgreementV2,
  fromAgreementV2,
  genericInternalError,
} from "pagopa-interop-models";
import {
  EmailManager,
  Logger,
  buildHTMLTemplateService,
  dateAtRomeZone,
} from "pagopa-interop-commons";
import {
  InstitutionResponse,
  SelfcareV2Client,
  mapInstitutionError,
} from "pagopa-interop-selfcare-v2-client";
import {
  descriptorNotFound,
  eServiceNotFound,
  institutionNotFound,
  selfcareIdNotFound,
} from "../models/errors.js";
import { agreementEmailSenderConfig } from "../utilities/config.js";
import { ReadModelService } from "./readModelService.js";

async function getActivationMailFromAgreement(
  agreementV2: AgreementV2,
  readModelService: ReadModelService,
  selfcareV2Client: SelfcareV2Client,
  logger: Logger
): Promise<{
  subject: string;
  body: string;
  to: string[];
}> {
  const agreement = fromAgreementV2(agreementV2);
  const templateService = buildHTMLTemplateService();
  const filename = fileURLToPath(import.meta.url);
  const dirname = path.dirname(filename);

  const { getEServiceById, getTenantById } = readModelService;

  const htmlTemplateBuffer = await fs.readFile(
    `${dirname}/../resources/templates/activation-mail.html`
  );
  const htmlTemplate = htmlTemplateBuffer.toString();

  const activationDate = agreement.stamps.activation?.when;

  if (activationDate === undefined) {
    throw genericInternalError(
      `Activation date not found for agreement ${agreement.id}`
    );
  }
  const formattedActivationDate = dateAtRomeZone(
    new Date(Number(activationDate))
  );

  const [eservice, producer, consumer] = await Promise.all([
    getEServiceById(agreement.eserviceId),
    getTenantById(agreement.producerId),
    getTenantById(agreement.consumerId),
  ]);

  if (!eservice) {
    throw eServiceNotFound(agreement.eserviceId);
  }

  if (!producer) {
    throw genericInternalError(
      `Produce tenant not found for agreement ${agreement.id}`
    );
  }

  if (!consumer) {
    throw genericInternalError(
      `Consumer tenant not found for agreement ${agreement.id}`
    );
  }

  const producerSelfcareId = producer.selfcareId;
  if (!producerSelfcareId) {
    throw selfcareIdNotFound(producer.id);
  }

  const consumerSelfcareId = consumer.selfcareId;
  if (!consumerSelfcareId) {
    throw selfcareIdNotFound(consumer.id);
  }

  const producerInstitution = await getInstitution(
    producerSelfcareId,
    selfcareV2Client,
    logger
  );

  const consumerInstitution = await getInstitution(
    consumerSelfcareId,
    selfcareV2Client,
    logger
  );

  const producerEmail = producerInstitution?.digitalAddress;
  const consumerEmail = consumerInstitution?.digitalAddress;

  if (!producerEmail) {
    throw genericInternalError(
      `Producer digital address not found for agreement ${agreement.id}`
    );
  }

  if (!consumerEmail) {
    throw genericInternalError(
      `Consumer digital address not found for agreement ${agreement.id}`
    );
  }

  const descriptor = eservice.descriptors.find(
    (d) => d.id === agreement.descriptorId
  );

  if (!descriptor) {
    throw descriptorNotFound(agreement.eserviceId, agreement.descriptorId);
  }

  return {
    subject: `Richiesta di fruizione ${agreement.id} attiva`,
    to: [producerEmail, consumerEmail],
    body: templateService.compileHtml(htmlTemplate, {
      activationDate: formattedActivationDate,
      agreementId: agreement.id,
      eserviceName: eservice.name,
      eserviceVersion: descriptor.version,
      producerName: producer.name,
      consumerName: consumer.name,
    }),
  };
}

// eslint-disable-next-line max-params
export async function sendAgreementEmail(
  agreement: AgreementV2,
  readModelService: ReadModelService,
  selfcareV2Client: SelfcareV2Client,
  emailManager: EmailManager,
  logger: Logger,
  { agreementEmailSender } = agreementEmailSenderConfig()
): Promise<void> {
  const { to, subject, body } = await getActivationMailFromAgreement(
    agreement,
    readModelService,
    selfcareV2Client,
    logger
  );

  await emailManager.send(agreementEmailSender, to, subject, body);
}

async function getInstitution(
  id: string,
  selfcareV2Client: SelfcareV2Client,
  logger: Logger
): Promise<InstitutionResponse> {
  try {
    return await selfcareV2Client.getInstitution({
      params: { id },
    });
  } catch (error) {
    logger.error(`Error calling selfcare API for institution ${id} - ${error}`);

    const code = mapInstitutionError(error, selfcareV2Client.api);
    if (code === 404) {
      throw institutionNotFound(id);
    }
    throw genericInternalError(`Error getting institution ${id}`);
  }
}
