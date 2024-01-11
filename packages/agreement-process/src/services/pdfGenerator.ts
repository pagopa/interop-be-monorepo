/* eslint-disable max-params */
/*
  IMPORTANT
  TODO: This service is a mock for the PDF generator it is used as entrypoint for the PDF generation.
  It must be substituted with the real service when it will be developed.
 */

import fs from "fs";
import path from "path";

import { selfcareServiceMock, initFileManager } from "pagopa-interop-commons";
import {
  Agreement,
  AgreementAttribute,
  AgreementInvolvedAttributes,
  CertifiedAgreementAttribute,
  DeclaredAgreementAttribute,
  EService,
  PDFPayload,
  Tenant,
  TenantAttributeType,
  UpdateAgreementSeed,
  VerifiedAgreementAttribute,
  genericError,
  tenantAttributeType,
} from "pagopa-interop-models";
import { v4 as uuidv4 } from "uuid";
import {
  agreementMissingUserInfo,
  agreementStampNotFound,
} from "../model/domain/errors.js";
import { ApiAgreementDocumentSeed } from "../model/types.js";
import { config } from "../utilities/config.js";
import { AttributeQuery } from "./readmodel/attributeQuery.js";

const fileManager = initFileManager(config);

const getAttributeInvolved = async (
  consumer: Tenant,
  seed: UpdateAgreementSeed,
  attributeQuery: AttributeQuery
): Promise<AgreementInvolvedAttributes> => {
  const getAgreementAttributeByType = async <
    T extends
      | CertifiedAgreementAttribute
      | DeclaredAgreementAttribute
      | VerifiedAgreementAttribute
  >(
    type: TenantAttributeType
  ): Promise<Array<[AgreementAttribute, T]>> => {
    const seedAttributes = seed.certifiedAttributes.map((ca) => ca.id);
    const attributes = consumer.attributes.filter(
      (a) => a.type === type && seedAttributes.includes(a.id)
    );

    return Promise.all(
      attributes.map(async (attr) => {
        const att = await attributeQuery.getAttributeById(attr.id);
        if (!att?.data) {
          throw genericError(`Attribute ${attr.id} not found`);
        }
        return [{ id: attr.id }, att.data as unknown as T];
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
  seed: UpdateAgreementSeed
): Promise<[string, Date]> => {
  const submission = seed.stamps.submission;
  if (!submission) {
    throw agreementStampNotFound("submission");
  }
  const user = await selfcareServiceMock.getUserById(submission.who);

  if (user?.name && user?.familyName && user?.fiscalCode) {
    return [
      `${user.name} ${user.familyName} (${user.fiscalCode})`,
      submission.when,
    ];
  }

  throw agreementMissingUserInfo(submission.who);
};

const getActivationInfo = async (
  seed: UpdateAgreementSeed
): Promise<[string, Date]> => {
  const activation = seed.stamps.activation;

  if (!activation) {
    throw agreementStampNotFound("activation");
  }

  const user = await selfcareServiceMock.getUserById(activation.who);
  if (user?.name && user?.familyName && user?.fiscalCode) {
    return [
      `${user.name} ${user.familyName} (${user.fiscalCode})`,
      activation.when,
    ];
  }

  throw agreementMissingUserInfo(activation.who);
};

const getPdfPayload = async (
  agreement: Agreement,
  eService: EService,
  consumer: Tenant,
  producer: Tenant,
  seed: UpdateAgreementSeed,
  attributeQuery: AttributeQuery
): Promise<PDFPayload> => {
  const { certified, declared, verified } = await getAttributeInvolved(
    consumer,
    seed,
    attributeQuery
  );
  const [submitter, submissionTimestamp] = await getSubmissionInfo(seed);
  const [activator, activationTimestamp] = await getActivationInfo(seed);

  return {
    today: new Date(),
    agreementId: agreement.id,
    eService: eService.name,
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
  consumerId: string,
  producerId: string
): string => `${consumerId}_${producerId}_${new Date()}_agreement_contract.pdf`;

export const pdfGenerator = {
  createDocumentSeed: async (
    agreement: Agreement,
    eService: EService,
    consumer: Tenant,
    producer: Tenant,
    seed: UpdateAgreementSeed,
    attributeQuery: AttributeQuery
  ): Promise<ApiAgreementDocumentSeed> => {
    const documentId = uuidv4();
    const prettyName = "Richiesta di fruizione";
    const documentName = createAgreementDocumentName(
      agreement.consumerId,
      agreement.producerId
    );
    const pdfPayload = await getPdfPayload(
      agreement,
      eService,
      consumer,
      producer,
      seed,
      attributeQuery
    );
    const document = await create(agreementTemplateMock, pdfPayload);

    /* 
      TODO : this method should be respect this behaviours https://github.com/pagopa/interop-be-agreement-process/blob/66781549a6db2470d8c407965b7561d1fe493107/src/main/scala/it/pagopa/interop/agreementprocess/service/AgreementContractCreator.scala#L57
      handled with task https://pagopa.atlassian.net/browse/IMN-138
    */
    const path = await fileManager.storeBytes(
      documentId,
      documentName,
      new Uint8Array(document)
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
