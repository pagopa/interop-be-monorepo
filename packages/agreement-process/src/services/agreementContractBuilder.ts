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
  AgreementContractPDFPayload,
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
} from "pagopa-interop-models";
import { match } from "ts-pattern";
import { getVerifiedAttributeExpirationDate } from "pagopa-interop-agreement-lifecycle";
import { attributeNotFound } from "../model/domain/errors.js";
import { AgreementProcessConfig } from "../config/config.js";
import { assertStampExists } from "../model/domain/agreement-validators.js";
import { ReadModelService } from "./readModelService.js";
import { retrieveDescriptor, retrieveTenant } from "./agreementService.js";

const CONTENT_TYPE_PDF = "application/pdf";
const AGREEMENT_CONTRACT_PRETTY_NAME = "Richiesta di fruizione";

export type DelegationData = {
  producerDelegation: Delegation;
  delegator: Tenant;
  delegate: Tenant;
};

const createAgreementDocumentName = (
  consumerId: TenantId,
  producerId: TenantId,
  documentCreatedAt: Date
): string =>
  `${consumerId}_${producerId}_${formatDateyyyyMMddHHmmss(
    documentCreatedAt
  )}_agreement_contract.pdf`;

const getAttributesData = async (
  consumer: Tenant,
  agreement: Agreement,
  readModelService: ReadModelService
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
  readModelService: ReadModelService
): Promise<AgreementContractPDFPayload> => {
  const today = new Date();

  const { certified, declared, verified } = await getAttributesData(
    consumer,
    agreement,
    readModelService
  );

  const descriptor = retrieveDescriptor(agreement.descriptorId, eservice);

  assertStampExists(agreement.stamps, "submission");
  assertStampExists(agreement.stamps, "activation");

  return {
    todayDate: dateAtRomeZone(today),
    todayTime: timeAtRomeZone(today),
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
      };
    }),
    producerDelegationId: producerDelegationData?.producerDelegation.id,
    producerDelegatorName: producerDelegationData?.delegator.name,
    producerDelegatorIpaCode:
      producerDelegationData && getIpaCode(producerDelegationData?.delegator),
    producerDelegateName: producerDelegationData?.delegate.name,
    producerDelegateIpaCode:
      producerDelegationData && getIpaCode(producerDelegationData?.delegate),
  };
};

const buildProducerDelegationData = async (
  producerDelegation: Delegation,
  readModelService: ReadModelService
): Promise<DelegationData> => {
  const delegator = await retrieveTenant(
    producerDelegation.delegatorId,
    readModelService
  );
  const delegate = await retrieveTenant(
    producerDelegation.delegateId,
    readModelService
  );

  return {
    producerDelegation,
    delegator,
    delegate,
  };
};

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const contractBuilder = (
  readModelService: ReadModelService,
  pdfGenerator: PDFGenerator,
  fileManager: FileManager,
  config: AgreementProcessConfig,
  logger: Logger
) => {
  const filename = fileURLToPath(import.meta.url);
  const dirname = path.dirname(filename);
  const templateFilePath = path.resolve(
    dirname,
    "..",
    "resources/templates/documents",
    "agreementContractTemplate.html"
  );

  return {
    createContract: async (
      agreement: Agreement,
      eservice: EService,
      consumer: Tenant,
      producer: Tenant,
      producerDelegation: Delegation | undefined
    ): Promise<AgreementDocument> => {
      const producerDelegationData =
        producerDelegation &&
        (await buildProducerDelegationData(
          producerDelegation,
          readModelService
        ));

      const pdfPayload = await getPdfPayload(
        agreement,
        eservice,
        consumer,
        producer,
        producerDelegationData,
        readModelService
      );

      const pdfBuffer: Buffer = await pdfGenerator.generate(
        templateFilePath,
        pdfPayload
      );

      const documentId = generateId<AgreementDocumentId>();
      const documentCreatedAt = new Date();
      const documentName = createAgreementDocumentName(
        agreement.consumerId,
        agreement.producerId,
        documentCreatedAt
      );

      const documentPath = await fileManager.storeBytes(
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
        createdAt: documentCreatedAt,
      };
    },
  };
};

export type ContractBuilder = ReturnType<typeof contractBuilder>;
