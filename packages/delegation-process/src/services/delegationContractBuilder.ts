import { fileURLToPath } from "url";
import path from "path";
import {
  dateAtRomeZone,
  FileManager,
  formatDateyyyyMMddHHmmss,
  Logger,
  PDFGenerator,
  timeAtRomeZone,
} from "pagopa-interop-commons";
import {
  Delegation,
  DelegationContractDocument,
  DelegationContractId,
  delegationKind,
  EService,
  generateId,
  Tenant,
} from "pagopa-interop-models";
import { match } from "ts-pattern";
import { DelegationProcessConfig } from "../config/config.js";
import {
  DelegationActivationPDFPayload,
  DelegationRevocationPDFPayload,
} from "../model/domain/models.js";
import { assertStampExists } from "./validators.js";

const CONTENT_TYPE_PDF = "application/pdf";
const DELEGATION_ACTIVATION_CONTRACT_PRETTY_NAME = "Delega";
const DELEGATION_REVOCATION_CONTRACT_PRETTY_NAME = "Revoca della delega";

const createDelegationDocumentName = (
  documentCreatedAt: Date,
  documentType: "activation" | "revocation"
): string =>
  `${formatDateyyyyMMddHHmmss(
    documentCreatedAt
  )}_delegation_${documentType}_contract.pdf`;

const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);

function getDelegationText(delegation: Delegation): string {
  return match(delegation.kind)
    .with(delegationKind.delegatedProducer, () => "all’erogazione")
    .with(delegationKind.delegatedConsumer, () => "alla fruizione")
    .exhaustive();
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const contractBuilder = {
  createActivationContract: async ({
    delegation,
    delegator,
    delegate,
    eservice,
    pdfGenerator,
    fileManager,
    config,
    logger,
  }: {
    delegation: Delegation;
    delegator: Tenant;
    delegate: Tenant;
    eservice: EService;
    pdfGenerator: PDFGenerator;
    fileManager: FileManager;
    config: DelegationProcessConfig;
    logger: Logger;
  }): Promise<DelegationContractDocument> => {
    const templateFilePath = path.resolve(
      dirname,
      "..",
      "resources/templates",
      "delegationApprovedTemplate.html"
    );

    const documentCreatedAt = new Date();
    const todayDate = dateAtRomeZone(documentCreatedAt);
    const todayTime = timeAtRomeZone(documentCreatedAt);

    const documentId = generateId<DelegationContractId>();
    const documentName = createDelegationDocumentName(
      documentCreatedAt,
      "activation"
    );

    assertStampExists(delegation.stamps, "activation");

    const submissionDate = dateAtRomeZone(delegation.stamps.submission.when);
    const submissionTime = timeAtRomeZone(delegation.stamps.submission.when);
    const activationDate = dateAtRomeZone(delegation.stamps.activation.when);
    const activationTime = timeAtRomeZone(delegation.stamps.activation.when);
    const activationContractPayload: DelegationActivationPDFPayload = {
      delegationKindText: getDelegationText(delegation),
      todayDate,
      todayTime,
      delegationId: delegation.id,
      delegatorName: delegator.name,
      delegatorCode: delegator.externalId.value,
      delegateName: delegate.name,
      delegateCode: delegate.externalId.value,
      eserviceId: eservice.id,
      eserviceName: eservice.name,
      submitterId: delegation.stamps.submission.who,
      submissionDate,
      submissionTime,
      activatorId: delegation.stamps.activation.who,
      activationDate,
      activationTime,
    };
    const pdfBuffer = await pdfGenerator.generate(
      templateFilePath,
      activationContractPayload
    );

    const documentPath = await fileManager.storeBytes(
      {
        bucket: config.s3Bucket,
        path: `${config.delegationDocumentPath}/${delegation.id}`,
        resourceId: documentId,
        name: documentName,
        content: pdfBuffer,
      },
      logger
    );

    return {
      id: documentId,
      name: documentName,
      prettyName: DELEGATION_ACTIVATION_CONTRACT_PRETTY_NAME,
      contentType: CONTENT_TYPE_PDF,
      path: documentPath,
      createdAt: documentCreatedAt,
    };
  },
  createRevocationContract: async ({
    delegation,
    delegator,
    delegate,
    eservice,
    pdfGenerator,
    fileManager,
    config,
    logger,
  }: {
    delegation: Delegation;
    delegator: Tenant;
    delegate: Tenant;
    eservice: EService;
    pdfGenerator: PDFGenerator;
    fileManager: FileManager;
    config: DelegationProcessConfig;
    logger: Logger;
  }): Promise<DelegationContractDocument> => {
    const templateFilePath = path.resolve(
      dirname,
      "..",
      "resources/templates",
      "delegationRevokedTemplate.html"
    );
    const documentCreatedAt = new Date();
    const todayDate = dateAtRomeZone(documentCreatedAt);
    const todayTime = timeAtRomeZone(documentCreatedAt);

    const documentId = generateId<DelegationContractId>();
    const documentName = createDelegationDocumentName(
      documentCreatedAt,
      "revocation"
    );

    assertStampExists(delegation.stamps, "revocation");
    const revocationDate = dateAtRomeZone(delegation.stamps.revocation.when);
    const revocationTime = timeAtRomeZone(delegation.stamps.revocation.when);

    const revocationContractPayload: DelegationRevocationPDFPayload = {
      delegationKindText: getDelegationText(delegation),
      todayDate,
      todayTime,
      delegationId: delegation.id,
      delegatorName: delegator.name,
      delegatorCode: delegator.externalId.value,
      delegateName: delegate.name,
      delegateCode: delegate.externalId.value,
      eserviceId: eservice.id,
      eserviceName: eservice.name,
      submitterId: delegation.stamps.submission.who,
      revokerId: delegation.stamps.revocation.who,
      revocationDate,
      revocationTime,
    };
    const pdfBuffer = await pdfGenerator.generate(
      templateFilePath,
      revocationContractPayload
    );

    const documentPath = await fileManager.storeBytes(
      {
        bucket: config.s3Bucket,
        path: `${config.delegationDocumentPath}/${delegation.id}`,
        resourceId: documentId,
        name: documentName,
        content: pdfBuffer,
      },
      logger
    );

    return {
      id: documentId,
      name: documentName,
      prettyName: DELEGATION_REVOCATION_CONTRACT_PRETTY_NAME,
      contentType: CONTENT_TYPE_PDF,
      path: documentPath,
      createdAt: documentCreatedAt,
    };
  },
};
