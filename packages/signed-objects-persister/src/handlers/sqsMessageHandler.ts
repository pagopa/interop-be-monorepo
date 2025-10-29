import { format } from "date-fns";
import { match, P } from "ts-pattern";
import { Message } from "@aws-sdk/client-sqs";

import {
  DocumentSignatureReference,
  FileManager,
  formatError,
  logger,
  Logger,
  RefreshableInteropToken,
  SafeStorageService,
  SignatureServiceBuilder,
} from "pagopa-interop-commons";

import {
  AgreementDocument,
  AgreementDocumentId,
  CorrelationId,
  DelegationContractDocument,
  DelegationContractId,
  PurposeId,
  PurposeVersionDocument,
  PurposeVersionDocumentId,
  unsafeBrandId,
} from "pagopa-interop-models";

import { config } from "../config/config.js";
import { FILE_KIND_CONFIG } from "../utils/fileKind.config.js";
import { insertSignedBeforeExtension } from "../utils/insertSignedBeforeExtension.js";
import { addPurposeRiskAnalysisSignedDocument } from "../utils/metadata/riskAnalysis.js";
import { addAgreementSignedContract } from "../utils/metadata/agreement.js";
import { addDelegationSignedContract } from "../utils/metadata/delegations.js";

import {
  SqsSafeStorageBody,
  SqsSafeStorageBodySchema,
} from "../models/sqsSafeStorageBody.js";

// eslint-disable-next-line max-params
async function processMessage(
  fileManager: FileManager,
  signatureService: SignatureServiceBuilder,
  message: SqsSafeStorageBody,
  safeStorageService: SafeStorageService,
  logger: Logger,
  refreshableToken: RefreshableInteropToken
): Promise<void> {
  try {
    const { id, detail } = message;
    const {
      key: fileKey,
      documentType,
      client_short_code: clientCode,
    } = detail;

    const signature = [
      "RISK_ANALYSIS_DOCUMENT",
      "AGREEMENT_CONTRACT",
      "DELEGATION_CONTRACT",
    ].includes(documentType)
      ? await signatureService.readDocumentSignatureReference(id)
      : await signatureService.readSignatureReference(id);

    if (!signature) {
      throw new Error(`Missing signature reference for message ${id}`);
    }

    const { fileKind } = signature;
    if (!(fileKind in FILE_KIND_CONFIG)) {
      throw new Error(`Unknown fileKind: ${fileKind}`);
    }

    const fileRef = await safeStorageService.getFile(fileKey);
    if (!fileRef.download?.url) {
      logger.error(
        `File reference for key "${fileKey}" is missing download URL`
      );
      throw new Error("Cannot process file without a download URL");
    }

    const fileContent = await safeStorageService.downloadFileContent(
      fileRef.download.url
    );

    const { bucket, process } =
      FILE_KIND_CONFIG[fileKind as keyof typeof FILE_KIND_CONFIG];
    const datePath = format(new Date(message.time), "yyyy/MM/dd");
    const path = `${clientCode}/${datePath}`;
    const fileName = insertSignedBeforeExtension(fileKey);

    const s3Key = await fileManager.resumeOrStoreBytes(
      { bucket, path, name: fileName, content: fileContent },
      logger
    );
    logger.info(`File successfully saved in S3 with key: ${s3Key}`);

    if (process) {
      const correlationId = unsafeBrandId<CorrelationId>(
        signature.correlationId
      );
      const docSignature = signature as DocumentSignatureReference;

      await match(process)
        .with("riskAnalysis", async () => {
          const metadata: PurposeVersionDocument = {
            id: unsafeBrandId<PurposeVersionDocumentId>(
              docSignature.subObjectId
            ),
            contentType: docSignature.contentType,
            path: s3Key,
            createdAt: new Date(Number(docSignature.createdAt)),
          };
          await addPurposeRiskAnalysisSignedDocument(
            docSignature.streamId as PurposeId,
            docSignature.subObjectId as PurposeVersionDocumentId,
            metadata,
            refreshableToken,
            correlationId
          );
        })
        .with("agreement", async () => {
          const metadata: AgreementDocument = {
            path: s3Key,
            name: docSignature.fileName,
            id: unsafeBrandId<AgreementDocumentId>(docSignature.streamId),
            prettyName: docSignature.prettyname,
            contentType: docSignature.contentType,
            createdAt: new Date(Number(docSignature.createdAt)),
          };
          await addAgreementSignedContract(
            metadata,
            refreshableToken,
            docSignature.streamId,
            correlationId
          );
        })
        .with("delegation", async () => {
          const metadata: DelegationContractDocument = {
            id: unsafeBrandId<DelegationContractId>(docSignature.streamId),
            name: docSignature.fileName,
            prettyName: docSignature.prettyname,
            contentType: docSignature.contentType,
            path: s3Key,
            createdAt: new Date(Number(docSignature.createdAt)),
          };
          await addDelegationSignedContract(
            metadata,
            refreshableToken,
            docSignature.streamId,
            correlationId
          );
        })
        .with(P._, () => logger.warn(`Unexpected process type: ${process}`))
        .exhaustive();
    }

    await signatureService.deleteSignatureReference(id);
    logger.info(
      `Record ${id} deleted from DynamoDB table ${config.signatureReferencesTableName}`
    );
  } catch (error) {
    logger.error(`Error processing message: ${formatError(error)}`);
    throw error;
  }
}

export const sqsMessageHandler = async (
  messagePayload: Message,
  fileManager: FileManager,
  signatureService: SignatureServiceBuilder,
  safeStorageService: SafeStorageService,
  refreshableToken: RefreshableInteropToken
): Promise<void> => {
  const logInstance: Logger = logger({ serviceName: config.serviceName });

  try {
    if (!messagePayload.Body) {
      throw new Error("Missing SQS message body");
    }

    logInstance.info(`Message Payload Body: ${messagePayload.Body}`);

    const parsed = SqsSafeStorageBodySchema.safeParse(
      JSON.parse(messagePayload.Body)
    );
    if (!parsed.success) {
      logInstance.error(`Invalid SQS message: ${parsed.error.message}`);
      throw new Error("Invalid SQS payload");
    }

    logInstance.info(`Parsed message: ${JSON.stringify(parsed.data)}`);

    await processMessage(
      fileManager,
      signatureService,
      parsed.data,
      safeStorageService,
      logInstance,
      refreshableToken
    );
  } catch (err) {
    logInstance.error(`Error handling SQS message: ${String(err)}`);
    throw err;
  }
};
