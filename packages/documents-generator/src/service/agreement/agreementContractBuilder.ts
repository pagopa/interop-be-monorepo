/* eslint-disable max-params */
import path from "path";
import { fileURLToPath } from "url";
import {
  FileManager,
  Logger,
  PDFGenerator,
  dateAtRomeZone,
  formatDateyyyyMMddHHmmss,
  getIpaCode,
  timeAtRomeZone,
} from "pagopa-interop-commons";
import {
  Agreement,
  AgreementDocumentId,
  Attribute,
  CertifiedTenantAttribute,
  DeclaredTenantAttribute,
  EService,
  Tenant,
  TenantAttributeType,
  TenantId,
  VerifiedTenantAttribute,
  generateId,
  tenantAttributeType,
  AgreementDocument,
  Delegation,
  AgreementStamp,
  AgreementStamps,
} from "pagopa-interop-models";
import { match } from "ts-pattern";
import {
  getVerifiedAttributeExpirationDate,
  getVerifiedAttributeDelegationId,
} from "pagopa-interop-agreement-lifecycle";

import {
  AgreementContractPDFPayload,
  ActiveDelegations,
} from "../../model/agreementModels.js";
import { DocumentsGeneratorConfig } from "../../config/config.js";
import {
  agreementStampNotFound,
  attributeNotFound,
} from "../../model/errors.js";
import { ReadModelServiceSQL } from "../readModelSql.js";
import { retrieveDescriptor, retrieveTenant } from "./agreementService.js";

const CONTENT_TYPE_PDF = "application/pdf";
const AGREEMENT_CONTRACT_PRETTY_NAME = "Richiesta di fruizione";

type DelegationData = {
  delegation: Delegation;
  delegate: Tenant;
};

const createAgreementDocumentName = (
  consumerId: TenantId,
  producerId: TenantId,
  documentCreatedAt: Date
): string =>
  `${formatDateyyyyMMddHHmmss(
    documentCreatedAt
  )}_${consumerId}_${producerId}_agreement_contract.pdf`;

const getAttributesData = async (
  consumer: Tenant,
  agreement: Agreement,
  readModelService: ReadModelServiceSQL
): Promise<{
  certified: Array<{
    attribute: Attribute;
    tenantAttribute: CertifiedTenantAttribute;
  }>;
  declared: Array<{
    attribute: Attribute;
    tenantAttribute: DeclaredTenantAttribute;
  }>;
  verified: Array<{
    attribute: Attribute;
    tenantAttribute: VerifiedTenantAttribute;
  }>;
}> => {
  const getAttributesDataByType = async <
    T extends
      | CertifiedTenantAttribute
      | DeclaredTenantAttribute
      | VerifiedTenantAttribute
  >(
    type: TenantAttributeType
  ): Promise<
    Array<{
      attribute: Attribute;
      tenantAttribute: T;
    }>
  > => {
    const seedAttributes = match(type)
      .with(
        tenantAttributeType.CERTIFIED,
        () => agreement.certifiedAttributes || []
      )
      .with(
        tenantAttributeType.DECLARED,
        () => agreement.declaredAttributes || []
      )
      .with(
        tenantAttributeType.VERIFIED,
        () => agreement.verifiedAttributes || []
      )
      .exhaustive()
      .map((attribute) => attribute.id);
    const tenantAttributes = consumer.attributes.filter(
      (a) => a.type === type && seedAttributes.includes(a.id)
    );

    return Promise.all(
      tenantAttributes.map(async (tenantAttribute) => {
        const attribute = await readModelService.getAttributeById(
          tenantAttribute.id
        );
        if (!attribute) {
          throw attributeNotFound(tenantAttribute.id);
        }
        return {
          attribute,
          tenantAttribute: tenantAttribute as T,
        };
      })
    );
  };

  const certified = await getAttributesDataByType<CertifiedTenantAttribute>(
    tenantAttributeType.CERTIFIED
  );
  const declared = await getAttributesDataByType<DeclaredTenantAttribute>(
    tenantAttributeType.DECLARED
  );
  const verified = await getAttributesDataByType<VerifiedTenantAttribute>(
    tenantAttributeType.VERIFIED
  );

  return {
    certified,
    declared,
    verified,
  };
};

const getPdfPayload = async (
  agreement: Agreement,
  eservice: EService,
  consumer: Tenant,
  producer: Tenant,
  producerDelegationData: DelegationData | undefined,
  consumerDelegationData: DelegationData | undefined,
  documentCreatedAt: Date,
  readModelService: ReadModelServiceSQL
): Promise<AgreementContractPDFPayload> => {
  const { certified, declared, verified } = await getAttributesData(
    consumer,
    agreement,
    readModelService
  );

  const descriptor = retrieveDescriptor(agreement.descriptorId, eservice);

  assertStampExists(agreement.stamps, "submission");
  assertStampExists(agreement.stamps, "activation");

  return {
    todayDate: dateAtRomeZone(documentCreatedAt),
    todayTime: timeAtRomeZone(documentCreatedAt),
    agreementId: agreement.id,
    submitterId: agreement.stamps.submission.who,
    submissionDate: dateAtRomeZone(agreement.stamps.submission.when),
    submissionTime: timeAtRomeZone(agreement.stamps.submission.when),
    activatorId: agreement.stamps.activation.who,
    activationDate: dateAtRomeZone(agreement.stamps.activation.when),
    activationTime: timeAtRomeZone(agreement.stamps.activation.when),
    eserviceId: eservice.id,
    eserviceName: eservice.name,
    descriptorId: agreement.descriptorId,
    descriptorVersion: descriptor.version,
    producerName: producer.name,
    producerIpaCode: getIpaCode(producer),
    consumerName: consumer.name,
    consumerIpaCode: getIpaCode(consumer),
    certifiedAttributes: certified.map(({ attribute, tenantAttribute }) => ({
      assignmentDate: dateAtRomeZone(tenantAttribute.assignmentTimestamp),
      assignmentTime: timeAtRomeZone(tenantAttribute.assignmentTimestamp),
      attributeName: attribute.name,
      attributeId: attribute.id,
    })),
    // eslint-disable-next-line sonarjs/no-identical-functions
    declaredAttributes: declared.map(({ attribute, tenantAttribute }) => ({
      assignmentDate: dateAtRomeZone(tenantAttribute.assignmentTimestamp),
      assignmentTime: timeAtRomeZone(tenantAttribute.assignmentTimestamp),
      attributeName: attribute.name,
      attributeId: attribute.id,
      delegationId: tenantAttribute.delegationId,
    })),
    verifiedAttributes: verified.map(({ attribute, tenantAttribute }) => {
      const expirationDate = getVerifiedAttributeExpirationDate(
        producer.id,
        tenantAttribute
      );
      return {
        assignmentDate: dateAtRomeZone(tenantAttribute.assignmentTimestamp),
        assignmentTime: timeAtRomeZone(tenantAttribute.assignmentTimestamp),
        attributeName: attribute.name,
        attributeId: attribute.id,
        expirationDate: expirationDate
          ? dateAtRomeZone(expirationDate)
          : undefined,
        delegationId: getVerifiedAttributeDelegationId(
          producer.id,
          tenantAttribute
        ),
      };
    }),
    producerDelegationId: producerDelegationData?.delegation.id,
    producerDelegateName: producerDelegationData?.delegate.name,
    producerDelegateIpaCode:
      producerDelegationData && getIpaCode(producerDelegationData?.delegate),
    consumerDelegationId: consumerDelegationData?.delegation.id,
    consumerDelegateName: consumerDelegationData?.delegate.name,
    consumerDelegateIpaCode:
      consumerDelegationData && getIpaCode(consumerDelegationData?.delegate),
  };
};

const buildDelegationData = async (
  delegation: Delegation,
  readModelService: ReadModelServiceSQL
): Promise<DelegationData> => {
  const delegate = await retrieveTenant(
    readModelService,
    delegation.delegateId
  );

  return {
    delegation,
    delegate,
  };
};

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const agreementContractBuilder = (
  readModelService: ReadModelServiceSQL,
  pdfGenerator: PDFGenerator,
  fileManager: FileManager,
  config: DocumentsGeneratorConfig,
  logger: Logger
) => {
  const filename = fileURLToPath(import.meta.url);
  const dirname = path.dirname(filename);
  const templateFilePath = path.resolve(
    dirname,
    "../..",
    "resources/agreement",
    "agreementContractTemplate.html"
  );

  return {
    createContract: async (
      agreement: Agreement,
      eservice: EService,
      consumer: Tenant,
      producer: Tenant,
      { producerDelegation, consumerDelegation }: ActiveDelegations,
      messageTimestamp: Date
    ): Promise<AgreementDocument> => {
      const producerDelegationData =
        producerDelegation &&
        (await buildDelegationData(producerDelegation, readModelService));

      const consumerDelegationData =
        consumerDelegation &&
        (await buildDelegationData(consumerDelegation, readModelService));

      const documentCreatedAt = messageTimestamp;

      const pdfPayload = await getPdfPayload(
        agreement,
        eservice,
        consumer,
        producer,
        producerDelegationData,
        consumerDelegationData,
        documentCreatedAt,
        readModelService
      );

      const pdfBuffer: Buffer = await pdfGenerator.generate(
        templateFilePath,
        pdfPayload
      );

      const documentId = generateId<AgreementDocumentId>();
      const documentName = createAgreementDocumentName(
        agreement.consumerId,
        agreement.producerId,
        documentCreatedAt
      );

      const documentPath = await fileManager.resumeOrStoreBytes(
        {
          bucket: config.s3Bucket,
          path: `${config.agreementContractsPath}/${agreement.id}`,
          resourceId: documentId,
          name: documentName,
          content: pdfBuffer,
        },
        logger
      );

      return {
        id: documentId,
        name: documentName,
        contentType: CONTENT_TYPE_PDF,
        prettyName: AGREEMENT_CONTRACT_PRETTY_NAME,
        path: documentPath,
        createdAt: new Date(),
      };
    },
  };
};

function assertStampExists<S extends keyof AgreementStamps>(
  stamps: AgreementStamps,
  stamp: S
): asserts stamps is AgreementStamps & {
  [key in S]: AgreementStamp;
} {
  if (!stamps[stamp]) {
    throw agreementStampNotFound(stamp);
  }
}

export type ContractBuilder = ReturnType<typeof agreementContractBuilder>;
