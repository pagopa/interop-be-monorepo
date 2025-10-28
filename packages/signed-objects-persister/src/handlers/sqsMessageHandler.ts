import {
  FileManager,
  formatError,
  logger,
  Logger,
  RefreshableInteropToken,
  SafeStorageService,
} from "pagopa-interop-commons";
import { Message } from "@aws-sdk/client-sqs";
import { format } from "date-fns";
import { match, P } from "ts-pattern";
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
import { SignatureServiceBuilder } from "pagopa-interop-commons";
import {
  SqsSafeStorageBody,
  SqsSafeStorageBodySchema,
} from "../models/sqsSafeStorageBody.js";
import { config } from "../config/config.js";
import { FILE_KIND_CONFIG } from "../utils/fileKind.config.js";
import { insertSignedBeforeExtension } from "../utils/insertSignedBeforeExtension.js";
import { addPurposeRiskAnalysisSignedDocument } from "../utils/metadata/riskAnalysis.js";
import { addAgreementSignedContract } from "../utils/metadata/agreement.js";
import { addDelegationSignedContract } from "../utils/metadata/delegations.js";

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
    const fileKey = message.detail.key;

    const signature = await signatureService.readDocumentSignatureReference(
      message.id
    );
    if (!signature) {
      throw new Error(`Missing signature reference for message ${message.id}`);
    }

    const fileKind = signature.fileKind;
    if (!(fileKind in FILE_KIND_CONFIG)) {
      throw new Error(`Unknown fileKind: ${fileKind}`);
    }

    const fileRef = await safeStorageService.getFile(fileKey);

    if (!fileRef.download?.url) {
      logger.error(
        `File reference for key "${fileKey}" is missing download URL`
      );
      throw new Error(`Cannot process file without a download URL`);
    }

    const fileContent = await safeStorageService.downloadFileContent(
      fileRef.download.url
    );

    const configForKind =
      FILE_KIND_CONFIG[fileKind as keyof typeof FILE_KIND_CONFIG];

    const clientShortCode = message.detail.client_short_code;
    const date = new Date(message.time);
    const datePath = format(date, "yyyy/MM/dd");

    const path = `${clientShortCode}/${datePath}`;
    const fileName = insertSignedBeforeExtension(fileKey);

    const key = await fileManager.resumeOrStoreBytes(
      {
        bucket: configForKind.bucket,
        path,
        name: fileName,
        content: fileContent,
      },
      logger
    );
    logger.info(`File successfully saved in S3 with key: ${key}`);

    if (configForKind.process) {
      const correlationId = unsafeBrandId<CorrelationId>(
        signature.correlationId
      );
      await match(configForKind.process)
        .with("riskAnalysis", async () => {
          const metadata: PurposeVersionDocument = {
            id: unsafeBrandId<PurposeVersionDocumentId>(signature.subObjectId),
            contentType: signature.contentType,
            path: key,
            createdAt: new Date(Number(signature.createdAt)),
          };
          await addPurposeRiskAnalysisSignedDocument(
            signature.streamId as PurposeId,
            signature.subObjectId as PurposeVersionDocumentId,
            metadata,
            refreshableToken,
            correlationId
          );
        })
        .with("agreement", async () => {
          const metadata: AgreementDocument = {
            path: key,
            name: signature.fileName,
            id: unsafeBrandId<AgreementDocumentId>(signature.streamId),
            prettyName: signature.prettyname,
            contentType: signature.contentType,
            createdAt: new Date(Number(signature.createdAt)),
          };
          await addAgreementSignedContract(
            metadata,
            refreshableToken,
            signature.streamId,
            correlationId
          );
        })
        .with("delegation", async () => {
          const metadata: DelegationContractDocument = {
            id: unsafeBrandId<DelegationContractId>(signature.streamId),
            name: signature.fileName,
            prettyName: signature.prettyname,
            contentType: signature.contentType,
            path: key,
            createdAt: new Date(Number(signature.createdAt)),
          };
          await addDelegationSignedContract(
            metadata,
            refreshableToken,
            signature.streamId,
            correlationId
          );
        })
        .with(P._, () => {
          logger.warn(
            `Found unexpected configForKind.process ${configForKind.process} `
          );
        })
        .exhaustive();
    }

    await signatureService.deleteSignatureReference(message.id);
    logger.info(`Record ${message.id} deleted from DynamoDB`);
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
    logInstance.info(`parsed: ${JSON.stringify(parsed.data)}`);
    if (!parsed.success) {
      logInstance.error(`Invalid SQS message: ${parsed.error.message}`);
      throw new Error("Invalid SQS payload");
    }

    const validatedMessage = parsed.data;

    await processMessage(
      fileManager,
      signatureService,
      validatedMessage,
      safeStorageService,
      logInstance,
      refreshableToken
    );
  } catch (err) {
    logInstance.error(`Error handling SQS message: ${String(err)}`);
    throw err;
  }
};
