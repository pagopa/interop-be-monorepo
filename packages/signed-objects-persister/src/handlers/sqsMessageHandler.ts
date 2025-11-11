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

import { S3ServiceException } from "@aws-sdk/client-s3";
import { config } from "../config/config.js";
import { FILE_KIND_CONFIG } from "../utils/fileKind.config.js";
import { appendSignedSuffixToFileName } from "../utils/appendSignedSuffixToFileName.js";
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
    const { key: fileKey, client_short_code: clientCode } = detail;

    const signature = await signatureService.readSignatureReferenceById(
      fileKey
    );

    if (!signature) {
      throw new Error(`Missing signature reference for message ${id}`);
    }
    const { fileKind } = signature;

    if (!(fileKind in FILE_KIND_CONFIG)) {
      throw new Error(`Unknown fileKind: ${fileKind}`);
    }

    const fileRef = await safeStorageService.getFile(fileKey);
    if (!fileRef.download?.url) {
      throw new Error(`Missing download URL for fileKey: ${fileKey}`);
    }
    const fileContent = await safeStorageService.downloadFileContent(
      fileRef.download.url
    );

    const { bucket, process } =
      FILE_KIND_CONFIG[fileKind as keyof typeof FILE_KIND_CONFIG];
    const datePath = format(new Date(message.time), "yyyy/MM/dd");
    const path = `${clientCode}/${datePath}`;
    const fileName = appendSignedSuffixToFileName(fileKey);

    // immutable s3Key with 409 handling for specific documentTypes
    const s3Key: string = await (async (): Promise<string> => {
      try {
        return await fileManager.resumeOrStoreBytes(
          { bucket, path, name: fileName, content: fileContent },
          logger
        );
      } catch (error) {
        const isConflict =
          error instanceof S3ServiceException &&
          (error.$metadata?.httpStatusCode === 409 ||
            error.name === "Conflict");

        const allowConflictWarning =
          fileKind === "RISK_ANALYSIS_DOCUMENT" ||
          fileKind === "AGREEMENT_CONTRACT";

        if (isConflict && allowConflictWarning) {
          logger.warn(
            `Conflict (409) uploading s3://${bucket}/${path}/${fileName} — file already exists, continuing`
          );
          return `${path}/${fileName}`;
        }
        throw error;
      }
    })();

    logger.info(`File successfully saved in S3 with key: ${s3Key}`);

    const buildMetadata = (): {
      metadataMap: {
        readonly riskAnalysis: () => PurposeVersionDocument;
        readonly agreement: () => AgreementDocument;
        readonly delegation: () => DelegationContractDocument;
      };
      correlationId: CorrelationId;
      docSignature: DocumentSignatureReference;
    } => {
      const correlationId = unsafeBrandId<CorrelationId>(
        signature.correlationId
      );
      const docSignature = signature as DocumentSignatureReference;

      const metadataMap = {
        riskAnalysis: (): PurposeVersionDocument => ({
          id: unsafeBrandId<PurposeVersionDocumentId>(docSignature.subObjectId),
          contentType: docSignature.contentType,
          path: s3Key,
          createdAt: new Date(Number(docSignature.createdAt)),
        }),
        agreement: (): AgreementDocument => ({
          path: s3Key,
          name: docSignature.fileName,
          id: unsafeBrandId<AgreementDocumentId>(docSignature.streamId),
          prettyName: docSignature.prettyname,
          contentType: docSignature.contentType,
          createdAt: new Date(Number(docSignature.createdAt)),
        }),
        delegation: (): DelegationContractDocument => ({
          id: unsafeBrandId<DelegationContractId>(docSignature.streamId),
          name: docSignature.fileName,
          prettyName: docSignature.prettyname,
          contentType: docSignature.contentType,
          path: s3Key,
          createdAt: new Date(Number(docSignature.createdAt)),
        }),
      } as const;

      return { metadataMap, correlationId, docSignature };
    };

    if (process) {
      const { metadataMap, correlationId, docSignature } = buildMetadata();

      await match(process)
        .with("riskAnalysis", async () =>
          addPurposeRiskAnalysisSignedDocument(
            docSignature.streamId as PurposeId,
            docSignature.subObjectId as PurposeVersionDocumentId,
            metadataMap.riskAnalysis(),
            refreshableToken,
            correlationId
          )
        )
        .with("agreement", async () =>
          addAgreementSignedContract(
            metadataMap.agreement(),
            refreshableToken,
            docSignature.streamId,
            correlationId
          )
        )
        .with("delegation", async () =>
          addDelegationSignedContract(
            metadataMap.delegation(),
            refreshableToken,
            docSignature.streamId,
            correlationId
          )
        )
        .with(P._, () => logger.warn(`Unexpected process type: ${process}`))
        .exhaustive();
    }

    await signatureService.deleteSignatureReference(fileKey);
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

    logInstance.info(`SQS message body: ${messagePayload.Body}`);

    const parsed = SqsSafeStorageBodySchema.safeParse(
      JSON.parse(messagePayload.Body)
    );

    if (!parsed.success) {
      logInstance.error(`Invalid SQS message: ${parsed.error.message}`);
      throw new Error("Invalid SQS payload");
    }

    const messageData = parsed.data;
    logInstance.info(`Parsed SQS message: ${JSON.stringify(messageData)}`);

    await processMessage(
      fileManager,
      signatureService,
      messageData,
      safeStorageService,
      logInstance,
      refreshableToken
    );

    logInstance.info(`Message ${messageData.id} processed successfully`);
  } catch (error) {
    logInstance.error(`Error handling SQS message: ${formatError(error)}`);
    throw error;
  }
};
