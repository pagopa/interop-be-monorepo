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
  selfcareV2ClientApi,
  SelfcareV2UsersClient,
} from "pagopa-interop-api-clients";
import { match } from "ts-pattern";
import { isAxiosError } from "axios";
import {
  agreementMissingUserInfo,
  agreementSelfcareIdNotFound,
  agreementStampNotFound,
  attributeNotFound,
  userNotFound,
} from "../model/domain/errors.js";
import { AgreementProcessConfig } from "../config/config.js";
import { ReadModelService } from "./readModelService.js";

const CONTENT_TYPE_PDF = "application/pdf";
const AGREEMENT_CONTRACT_PRETTY_NAME = "Richiesta di fruizione";

const retrieveUser = async (
  selfcareV2Client: SelfcareV2UsersClient,
  selfcareId: SelfcareId,
  id: UserId
): Promise<selfcareV2ClientApi.UserResponse> => {
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
  agreement: Agreement,
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
  selfcareV2Client: SelfcareV2UsersClient,
  consumer: Tenant,
  agreement: Agreement
): Promise<[string, Date]> => {
  const submission = agreement.stamps.submission;
  if (!submission) {
    throw agreementStampNotFound("submission");
  }

  if (!consumer.selfcareId) {
    throw agreementSelfcareIdNotFound(consumer.id);
  }

  const consumerSelfcareId: SelfcareId = unsafeBrandId(consumer.selfcareId);

  const consumerUser: selfcareV2ClientApi.UserResponse = await retrieveUser(
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
  selfcareV2Client: SelfcareV2UsersClient,
  producer: Tenant,
  consumer: Tenant,
  agreement: Agreement
): Promise<[string, Date]> => {
  const activation = agreement.stamps.activation;
  if (!activation) {
    throw agreementStampNotFound("activation");
  }

  if (!producer.selfcareId) {
    throw agreementSelfcareIdNotFound(producer.id);
  }
  if (!consumer.selfcareId) {
    throw agreementSelfcareIdNotFound(consumer.id);
  }

  const producerSelfcareId: SelfcareId = unsafeBrandId(producer.selfcareId);
  const consumerSelfcareId: SelfcareId = unsafeBrandId(consumer.selfcareId);

  /**
   * The user that activated the agreement, the one in the activation.who stamp, could both belong to the producer institution or the consumer institution.
   * In case the user is not found with the producer institutionId, we try to retrieve it from the consumer selfcare.
   */

  // eslint-disable-next-line functional/no-let, @typescript-eslint/no-non-null-assertion
  let user: selfcareV2ClientApi.UserResponse = undefined!;

  try {
    user = await retrieveUser(
      selfcareV2Client,
      producerSelfcareId,
      activation.who
    );
  } catch (e) {
    if (isAxiosError(e) && e.response?.status === 404) {
      user = await retrieveUser(
        selfcareV2Client,
        consumerSelfcareId,
        activation.who
      );
    } else {
      throw e;
    }
  }

  if (user.name && user.surname && user.taxCode) {
    return [`${user.name} ${user.surname} (${user.taxCode})`, activation.when];
  }

  throw agreementMissingUserInfo(activation.who);
};

const getPdfPayload = async (
  agreement: Agreement,
  eservice: EService,
  consumer: Tenant,
  producer: Tenant,
  readModelService: ReadModelService,
  selfcareV2Client: SelfcareV2UsersClient
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
    agreement
  );
  const [activator, activationTimestamp] = await getActivationInfo(
    selfcareV2Client,
    producer,
    consumer,
    agreement
  );

  const { certified, declared, verified } = await getAttributeInvolved(
    consumer,
    agreement,
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
  selfcareV2Client: SelfcareV2UsersClient,
  config: AgreementProcessConfig,
  logger: Logger
) => {
  const filename = fileURLToPath(import.meta.url);
  const dirname = path.dirname(filename);

  return {
    createContract: async (
      agreement: Agreement,
      eservice: EService,
      consumer: Tenant,
      producer: Tenant
    ): Promise<AgreementDocument> => {
      const templateFilePath = path.resolve(
        dirname,
        "..",
        "resources/templates/documents",
        "agreementContractTemplate.html"
      );

      const pdfPayload = await getPdfPayload(
        agreement,
        eservice,
        consumer,
        producer,
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
