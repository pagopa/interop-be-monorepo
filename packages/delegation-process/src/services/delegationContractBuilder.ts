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
  EService,
  generateId,
  Tenant,
} from "pagopa-interop-models";
import { DelegationProcessConfig } from "../config/config.js";

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

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const contractBuilder = (
  fileManager: FileManager,
  config: DelegationProcessConfig,
  logger: Logger
) => {
  const filename = fileURLToPath(import.meta.url);
  const dirname = path.dirname(filename);

  return {
    createActivationContract: async (
      delegation: Delegation,
      delegator: Tenant,
      delegate: Tenant,
      eservice: EService,
      pdfGenerator: PDFGenerator
    ): Promise<DelegationContractDocument> => {
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

      const submissionDate = dateAtRomeZone(delegation.stamps.submission.when);
      const submissionTime = timeAtRomeZone(delegation.stamps.submission.when);

      const pdfBuffer = await pdfGenerator.generate(templateFilePath, {
        todayDate,
        todayTime,
        delegationId: delegation.id,
        delegatorName: delegator.name,
        delegatorCode: delegator.externalId.value,
        delegateName: delegate.name,
        delegateCode: delegate.externalId.value,
        submitterId: delegation.stamps.submission.who,
        eServiceName: eservice.name,
        eServiceId: eservice.id,
        submissionDate,
        submissionTime,
        activationDate: todayDate,
        activationTime: todayTime,
        activatorId: delegate.id,
      });

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
    createRevocationContract: async (
      delegation: Delegation,
      delegator: Tenant,
      delegate: Tenant,
      eservice: EService,
      pdfGenerator: PDFGenerator
    ): Promise<DelegationContractDocument> => {
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

      const pdfBuffer = await pdfGenerator.generate(templateFilePath, {
        todayDate,
        todayTime,
        delegationId: delegation.id,
        delegatorName: delegator.name,
        delegatorCode: delegator.externalId.value,
        delegateName: delegate.name,
        delegateCode: delegate.externalId.value,
        submitterId: delegation.stamps.submission.who,
        eServiceName: eservice.name,
        eServiceId: eservice.id,
        revocationDate: todayDate,
        revocationTime: todayTime,
        activatorId: delegate.id,
      });

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
};
