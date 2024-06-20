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
  SelfcareId,
  Tenant,
  TenantAttributeType,
  TenantId,
  VerifiedTenantAttribute,
  UserId,
  generateId,
  tenantAttributeType,
  unsafeBrandId,
  AgreementDocument,
} from "pagopa-interop-models";
import {
  SelfcareV2Client,
  UserResponse,
} from "pagopa-interop-selfcare-v2-client";
import { match } from "ts-pattern";
import {
  agreementMissingUserInfo,
  agreementSelfcareIdNotFound,
  agreementStampNotFound,
  attributeNotFound,
  userNotFound,
} from "../model/domain/errors.js";
import { UpdateAgreementSeed } from "../model/domain/models.js";
import { AgreementProcessConfig } from "../config/config.js";
import { ReadModelService } from "./readModelService.js";

const CONTENT_TYPE_PDF = "application/pdf";
const AGREEMENT_CONTRACT_PRETTY_NAME = "Richiesta di fruizione";

const retrieveUser = async (
  selfcareV2Client: SelfcareV2Client,
  selfcareId: SelfcareId,
  id: UserId
): Promise<UserResponse> => {
  const user = await selfcareV2Client.getUserInfoUsingGET({
    queries: { institutionId: selfcareId },
    params: { id },
  });

  if (!user) {
    throw userNotFound(selfcareId, id);
  }
  return user;
};

const createAgreementDocumentName = (
  consumerId: TenantId,
  producerId: TenantId,
  documentCreatedAt: Date
): string =>
  `${consumerId}_${producerId}_${formatDateyyyyMMddHHmmss(
    documentCreatedAt
  )}_agreement_contract.pdf`;

const getAttributeInvolved = async (
  consumer: Tenant,
  seed: UpdateAgreementSeed,
  readModelService: ReadModelService
): Promise<{
  certified: Array<[Attribute, CertifiedTenantAttribute]>;
  declared: Array<[Attribute, DeclaredTenantAttribute]>;
  verified: Array<[Attribute, VerifiedTenantAttribute]>;
}> => {
  const getAgreementAttributeByType = async <
    T extends
      | CertifiedTenantAttribute
      | DeclaredTenantAttribute
      | VerifiedTenantAttribute
  >(
    type: TenantAttributeType
  ): Promise<Array<[Attribute, T]>> => {
    const seedAttributes = match(type)
      .with(tenantAttributeType.CERTIFIED, () => seed.certifiedAttributes || [])
      .with(tenantAttributeType.DECLARED, () => seed.declaredAttributes || [])
      .with(tenantAttributeType.VERIFIED, () => seed.verifiedAttributes || [])
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
        return [attribute, tenantAttribute as unknown as T];
      })
    );
  };

  const certified = await getAgreementAttributeByType<CertifiedTenantAttribute>(
    tenantAttributeType.CERTIFIED
  );
  const declared = await getAgreementAttributeByType<DeclaredTenantAttribute>(
    tenantAttributeType.DECLARED
  );
  const verified = await getAgreementAttributeByType<VerifiedTenantAttribute>(
    tenantAttributeType.VERIFIED
  );

  return {
    certified,
    declared,
    verified,
  };
};

const getSubmissionInfo = async (
  selfcareV2Client: SelfcareV2Client,
  consumer: Tenant,
  seed: UpdateAgreementSeed
): Promise<[string, Date]> => {
  const submission = seed.stamps.submission;
  if (!submission) {
    throw agreementStampNotFound("submission");
  }

  if (!consumer.selfcareId) {
    throw agreementSelfcareIdNotFound(consumer.id);
  }

  const consumerSelfcareId: SelfcareId = unsafeBrandId(consumer.selfcareId);

  const consumerUser: UserResponse = await retrieveUser(
    selfcareV2Client,
    consumerSelfcareId,
    submission.who
  );
  if (consumerUser.name && consumerUser.surname && consumerUser.taxCode) {
    return [
      `${consumerUser.name} ${consumerUser.surname} (${consumerUser.taxCode})`,
      submission.when,
    ];
  }

  throw agreementMissingUserInfo(submission.who);
};

const getActivationInfo = async (
  selfcareV2Client: SelfcareV2Client,
  selfcareId: SelfcareId,
  seed: UpdateAgreementSeed
): Promise<[string, Date]> => {
  const activation = seed.stamps.activation;

  if (!activation) {
    throw agreementStampNotFound("activation");
  }

  const user: UserResponse = await retrieveUser(
    selfcareV2Client,
    selfcareId,
    activation.who
  );
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
  readModelService: ReadModelService,
  selfcareV2Client: SelfcareV2Client
): Promise<AgreementContractPDFPayload> => {
  const getTenantText = (name: string, origin: string, value: string): string =>
    origin === "IPA" ? `"${name} (codice IPA: ${value})` : name;

  const getCertifiedAttributeHtml = (
    certifiedAttributes: Array<[Attribute, CertifiedTenantAttribute]>
  ): string =>
    certifiedAttributes
      .map(
        (attTuple: [Attribute, CertifiedTenantAttribute]) => `
        <div>
          In data <strong>${dateAtRomeZone(
            attTuple[1].assignmentTimestamp
          )}</strong> alle ore <strong>${timeAtRomeZone(
          attTuple[1].assignmentTimestamp
        )}</strong>,l’Infrastruttura ha registrato il possesso da parte del Fruitore del seguente attributo <strong>${
          attTuple[0].name
        }</strong> certificato,necessario a soddisfare il requisito di fruizione stabilito dall’Erogatore per l’accesso all’E-service.
        </div>`
      )
      .join("");

  const getDeclaredAttributeHtml = (
    declaredAttributes: Array<[Attribute, DeclaredTenantAttribute]>
  ): string =>
    declaredAttributes
      .map(
        (attTuple: [Attribute, DeclaredTenantAttribute]) => `
      <div>
         In data <strong>${dateAtRomeZone(
           attTuple[1].assignmentTimestamp
         )}</strong> alle ore <strong>${timeAtRomeZone(
          attTuple[1].assignmentTimestamp
        )}</strong>,
         l’Infrastruttura ha registrato la dichiarazione del Fruitore di possedere il seguente attributo <strong>${
           attTuple[0].name
         }</strong> dichiarato
         ed avente il seguente periodo di validità ________,
         necessario a soddisfare il requisito di fruizione stabilito dall’Erogatore per l’accesso all’E-service.
      </div>`
      )
      .join("");

  const getVerifiedAttributeHtml = (
    verifiedAttributes: Array<[Attribute, VerifiedTenantAttribute]>
  ): string =>
    verifiedAttributes
      .map(
        (attTuple: [Attribute, VerifiedTenantAttribute]) => `
        <div>
          In data <strong>${dateAtRomeZone(
            attTuple[1].assignmentTimestamp
          )}</strong> alle ore <strong>${timeAtRomeZone(
          attTuple[1].assignmentTimestamp
        )}</strong>,
          l’Infrastruttura ha registrato la dichiarazione del Fruitore di possedere il seguente attributo <strong>${
            attTuple[0].name
          }</strong>,
          verificata dall’aderente ________ OPPURE dall’Erogatore stesso in data <strong>${dateAtRomeZone(
            attTuple[1].assignmentTimestamp
          )}</strong>,
          necessario a soddisfare il requisito di fruizione stabilito dall’Erogatore per l’accesso all’E-service.
        </div>`
      )
      .join();

  const today = new Date();
  const producerText = getTenantText(
    producer.name,
    producer.externalId.origin,
    producer.externalId.value
  );

  const consumerText = getTenantText(
    consumer.name,
    consumer.externalId.origin,
    consumer.externalId.value
  );
  const [submitter, submissionTimestamp] = await getSubmissionInfo(
    selfcareV2Client,
    consumer,
    seed
  );
  const [activator, activationTimestamp] = await getActivationInfo(
    selfcareV2Client,
    selfcareId,
    seed
  );

  const { certified, declared, verified } = await getAttributeInvolved(
    consumer,
    seed,
    readModelService
  );

  return {
    todayDate: dateAtRomeZone(today),
    todayTime: timeAtRomeZone(today),
    agreementId: agreement.id,
    submitter,
    submissionDate: dateAtRomeZone(submissionTimestamp),
    submissionTime: timeAtRomeZone(submissionTimestamp),
    activator,
    activationDate: dateAtRomeZone(activationTimestamp),
    activationTime: timeAtRomeZone(activationTimestamp),
    eServiceName: eservice.name,
    producerText,
    consumerText,
    certifiedAttributes: getCertifiedAttributeHtml(certified),
    declaredAttributes: getDeclaredAttributeHtml(declared),
    verifiedAttributes: getVerifiedAttributeHtml(verified),
  };
};

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const contractBuilder = (
  readModelService: ReadModelService,
  pdfGenerator: PDFGenerator,
  fileManager: FileManager,
  selfcareV2Client: SelfcareV2Client,
  config: AgreementProcessConfig,
  logger: Logger
) => {
  const filename = fileURLToPath(import.meta.url);
  const dirname = path.dirname(filename);

  return {
    createContract: async (
      selfcareId: SelfcareId,
      agreement: Agreement,
      eservice: EService,
      consumer: Tenant,
      producer: Tenant,
      seed: UpdateAgreementSeed
    ): Promise<AgreementDocument> => {
      const templateFilePath = path.resolve(
        dirname,
        "..",
        "resources/templates/documents",
        "agreementContractTemplate.html"
      );

      const pdfPayload = await getPdfPayload(
        selfcareId,
        agreement,
        eservice,
        consumer,
        producer,
        seed,
        readModelService,
        selfcareV2Client
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
        config.s3Bucket,
        `${config.agreementContractsPath}/${agreement.id}`,
        documentId,
        documentName,
        pdfBuffer,
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
