/* eslint-disable max-params */
/*
  IMPORTANT
  TODO: This service is a mock for the PDF generator it is used as entrypoint for the PDF generation.
  It must be substituted with the real service when it will be developed.
 */

import fs from "fs";
import path from "path";

import { FileManager, Logger } from "pagopa-interop-commons";
import {
  selfcareV2Client,
  UserResponse,
} from "pagopa-interop-selfcare-v2-client";
import {
  Agreement,
  AgreementAttribute,
  AgreementInvolvedAttributes,
  EService,
  PDFPayload,
  SelfcareId,
  Tenant,
  TenantAttributeType,
  TenantId,
  UserId,
  genericError,
  tenantAttributeType,
} from "pagopa-interop-models";
import { v4 as uuidv4 } from "uuid";
import { match } from "ts-pattern";
import {
  agreementMissingUserInfo,
  agreementStampNotFound,
  userNotFound,
} from "../model/domain/errors.js";
import { ApiAgreementDocumentSeed } from "../model/types.js";
import {
  CertifiedAgreementAttribute,
  DeclaredAgreementAttribute,
  UpdateAgreementSeed,
  VerifiedAgreementAttribute,
} from "../model/domain/models.js";
import { config } from "../utilities/config.js";
import { ReadModelService } from "./readModelService.js";
const getAttributeInvolved = async (
  consumer: Tenant,
  seed: UpdateAgreementSeed,
  readModelService: ReadModelService
): Promise<AgreementInvolvedAttributes> => {
  const getAgreementAttributeByType = async <
    T extends
      | CertifiedAgreementAttribute
      | DeclaredAgreementAttribute
      | VerifiedAgreementAttribute
  >(
    type: TenantAttributeType
  ): Promise<Array<[AgreementAttribute, T]>> => {
    const seedAttributes = match(type)
      .with(tenantAttributeType.CERTIFIED, () => seed.certifiedAttributes || [])
      .with(tenantAttributeType.DECLARED, () => seed.declaredAttributes || [])
      .with(tenantAttributeType.VERIFIED, () => seed.verifiedAttributes || [])
      .exhaustive()
      .map((ca) => ca.id);
    const attributes = consumer.attributes.filter(
      (a) => a.type === type && seedAttributes.includes(a.id)
    );

    return Promise.all(
      attributes.map(async (attr) => {
        const att = await readModelService.getAttributeById(attr.id);
        if (!att) {
          throw genericError(`Attribute ${attr.id} not found`);
        }
        return [{ id: attr.id }, att as unknown as T];
      })
    );
  };

  const certified =
    await getAgreementAttributeByType<CertifiedAgreementAttribute>(
      tenantAttributeType.CERTIFIED
    );
  const declared =
    await getAgreementAttributeByType<DeclaredAgreementAttribute>(
      tenantAttributeType.DECLARED
    );
  const verified =
    await getAgreementAttributeByType<VerifiedAgreementAttribute>(
      tenantAttributeType.VERIFIED
    );

  return {
    certified,
    declared,
    verified,
  };
};

const getSubmissionInfo = async (
  selfcareId: SelfcareId,
  seed: UpdateAgreementSeed
): Promise<[string, Date]> => {
  const submission = seed.stamps.submission;
  if (!submission) {
    throw agreementStampNotFound("submission");
  }
  const user: UserResponse = await retrieveUser(selfcareId, submission.who);

  if (user.name && user.surname && user.taxCode) {
    return [`${user.name} ${user.surname} (${user.taxCode})`, submission.when];
  }

  throw agreementMissingUserInfo(submission.who);
};

const getActivationInfo = async (
  selfcareId: SelfcareId,
  seed: UpdateAgreementSeed
): Promise<[string, Date]> => {
  const activation = seed.stamps.activation;

  if (!activation) {
    throw agreementStampNotFound("activation");
  }

  const user: UserResponse = await retrieveUser(selfcareId, activation.who);

  if (user.name && user.surname && user.taxCode) {
    return [`${user.name} ${user.surname} (${user.taxCode})`, activation.when];
  }

  throw agreementMissingUserInfo(activation.who);
};

const getPdfPayload = async (
  selfcareId: SelfcareId,
  agreement: Agreement,
  eservice: EService,
  consumer: Tenant,
  producer: Tenant,
  seed: UpdateAgreementSeed,
  readModelService: ReadModelService
): Promise<PDFPayload> => {
  const { certified, declared, verified } = await getAttributeInvolved(
    consumer,
    seed,
    readModelService
  );
  const [submitter, submissionTimestamp] = await getSubmissionInfo(
    selfcareId,
    seed
  );
  const [activator, activationTimestamp] = await getActivationInfo(
    selfcareId,
    seed
  );

  return {
    today: new Date(),
    agreementId: agreement.id,
    eservice: eservice.name,
    producerName: producer.name,
    producerOrigin: producer.externalId.origin,
    producerIPACode: producer.externalId.value,
    consumerName: consumer.name,
    consumerOrigin: consumer.externalId.origin,
    consumerIPACode: consumer.externalId.value,
    certified,
    declared,
    verified,
    submitter,
    submissionTimestamp,
    activator,
    activationTimestamp,
  };
};

// TODO : implement this method following this implementation https://github.com/pagopa/interop-be-agreement-process/blob/66781549a6db2470d8c407965b7561d1fe493107/src/main/scala/it/pagopa/interop/agreementprocess/service/PDFCreator.scala#L37
const create = async (
  _template: string,
  _pdfPayload: PDFPayload
): Promise<ArrayBuffer> => Buffer.from("Mock Document", "utf8");
const agreementTemplateMock = fs
  .readFileSync(
    path.resolve(new URL(import.meta.url + "/../..").pathname) +
      "/resources/templates/documents/agreementTemplate.html"
  )
  .toString();

const createAgreementDocumentName = (
  consumerId: TenantId,
  producerId: TenantId
): string => `${consumerId}_${producerId}_${new Date()}_agreement_contract.pdf`;

export const pdfGenerator = {
  createDocumentSeed: async (
    selfcareId: SelfcareId,
    agreement: Agreement,
    eservice: EService,
    consumer: Tenant,
    producer: Tenant,
    seed: UpdateAgreementSeed,
    readModelService: ReadModelService,
    storeFile: FileManager["storeBytes"],
    logger: Logger
  ): Promise<ApiAgreementDocumentSeed> => {
    const documentId = uuidv4();
    const prettyName = "Richiesta di fruizione";
    const documentName = createAgreementDocumentName(
      agreement.consumerId,
      agreement.producerId
    );
    const pdfPayload = await getPdfPayload(
      selfcareId,
      agreement,
      eservice,
      consumer,
      producer,
      seed,
      readModelService
    );
    const document = await create(agreementTemplateMock, pdfPayload);

    const path = await storeFile(
      config.s3Bucket,
      `${config.agreementContractsPath}/${agreement.id}`,
      documentId,
      documentName,
      Buffer.from(document),
      logger
    );

    return {
      id: documentId,
      name: documentName,
      contentType: "application/pdf",
      prettyName,
      path,
    };
  },
};
async function retrieveUser(
  selfcareId: SelfcareId,
  id: UserId
): Promise<UserResponse> {
  const user = await selfcareV2Client.getUserInfoUsingGET({
    queries: { institutionId: selfcareId },
    params: { id },
  });

  if (!user) {
    throw userNotFound(selfcareId, id);
  }
  return user;
}
