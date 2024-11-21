/* eslint-disable max-params */
import path from "path";
import { fileURLToPath } from "url";
import {
  FileManager,
  Logger,
  PDFGenerator,
  dateAtRomeZone,
  formatDateyyyyMMddHHmmss,
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
  PUBLIC_ADMINISTRATIONS_IDENTIFIER,
} from "pagopa-interop-models";
import { match } from "ts-pattern";
import { getVerifiedAttributeExpirationDate } from "pagopa-interop-agreement-lifecycle";
import {
  attributeNotFound,
  descriptorNotFound,
} from "../model/domain/errors.js";
import { AgreementProcessConfig } from "../config/config.js";
import { assertStampExists } from "../model/domain/agreement-validators.js";
import { ReadModelService } from "./readModelService.js";

const CONTENT_TYPE_PDF = "application/pdf";
const AGREEMENT_CONTRACT_PRETTY_NAME = "Richiesta di fruizione";

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
  readModelService: ReadModelService
): Promise<AgreementContractPDFPayload> => {
  const getIpaCode = (tenant: Tenant): string | undefined =>
    tenant.externalId.origin === PUBLIC_ADMINISTRATIONS_IDENTIFIER
      ? tenant.externalId.value
      : undefined;

  const today = new Date();

  const { certified, declared, verified } = await getAttributesData(
    consumer,
    agreement,
    readModelService
  );

  const descriptor = eservice.descriptors.find(
    (d) => d.id === agreement.descriptorId
  );

  if (!descriptor) {
    throw descriptorNotFound(eservice.id, agreement.descriptorId);
  }

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
      producer: Tenant
    ): Promise<AgreementDocument> => {
      const pdfPayload = await getPdfPayload(
        agreement,
        eservice,
        consumer,
        producer,
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
