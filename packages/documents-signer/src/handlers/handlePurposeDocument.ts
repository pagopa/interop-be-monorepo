import path from "path";
import {
  genericInternalError,
  missingKafkaMessageDataError,
  PurposeEventEnvelopeV2,
} from "pagopa-interop-models";
import {
  FileManager,
  Logger,
  SignatureServiceBuilder,
  SafeStorageService,
  FileCreationRequest,
} from "pagopa-interop-commons";
import { match, P } from "ts-pattern";
import { calculateSha256Base64 } from "../utils/checksum.js";
import { config } from "../config/config.js";

export async function handlePurposeDocument(
  decodedMessage: PurposeEventEnvelopeV2,
  signatureService: SignatureServiceBuilder,
  safeStorageService: SafeStorageService,
  fileManager: FileManager,
  logger: Logger
): Promise<void> {
  await match(decodedMessage)
    .with({ type: "RiskAnalysisDocumentGenerated" }, async (msg) => {
      if (!msg.data.purpose) {
        throw missingKafkaMessageDataError("purpose", msg.type);
      }
      if (msg.data.purpose.versions) {
        const purposeVersion = msg.data.purpose.versions.find(
          (v) => v.id === msg.data.versionId
        );

        if (!purposeVersion) {
          throw genericInternalError(
            `Handle Purpose Document - version not found for id: ${msg.data.versionId}`
          );
        }

        const s3Key = purposeVersion.riskAnalysis?.path;

        logger.info(
          `Processing and signing riskAnalysis file with key ${s3Key}`
        );

        if (!s3Key) {
          throw genericInternalError(
            `Handle Purpose Document - riskAnalysis path not found for id: ${msg.data.versionId}`
          );
        }

        const file: Uint8Array = await fileManager.get(
          config.s3Bucket,
          s3Key,
          logger
        );

        const fileName = path.basename(s3Key);
        const checksum = await calculateSha256Base64(Buffer.from(file));
        const contentType = "application/pdf";

        const safeStorageRequest: FileCreationRequest = {
          contentType,
          documentType: config.safeStorageDocType,
          status: config.safeStorageDocStatus,
          checksumValue: checksum,
        };

        const { uploadUrl, secret, key } = await safeStorageService.createFile(
          safeStorageRequest,
          logger
        );

        logger.info(`Created file on safe storage with key: ${key}`);

        await safeStorageService.uploadFileContent(
          uploadUrl,
          Buffer.from(file),
          contentType,
          secret,
          checksum,
          logger
        );

        await signatureService.saveDocumentSignatureReference(
          {
            safeStorageId: key,
            fileKind: "RISK_ANALYSIS_DOCUMENT",
            streamId: msg.data.purpose.id,
            subObjectId: msg.data.versionId,
            contentType,
            path: s3Key,
            prettyname: "",
            fileName,
            version: msg.event_version,
            createdAt: msg.data.purpose.createdAt,
            correlationId: msg.correlation_id ?? "",
          },
          logger
        );
      }
    })
    .with(
      {
        type: P.union(
          "PurposeAdded",
          "PurposeCloned",
          "PurposeActivated",
          "PurposeArchived",
          "DraftPurposeUpdated",
          "PurposeWaitingForApproval",
          "DraftPurposeDeleted",
          "WaitingForApprovalPurposeDeleted",
          "WaitingForApprovalPurposeVersionDeleted",
          "PurposeDeletedByRevokedDelegation",
          "NewPurposeVersionActivated",
          "NewPurposeVersionWaitingForApproval",
          "PurposeVersionActivated",
          "PurposeVersionOverQuotaUnsuspended",
          "PurposeVersionSuspendedByProducer",
          "PurposeVersionSuspendedByConsumer",
          "PurposeVersionUnsuspendedByProducer",
          "PurposeVersionUnsuspendedByConsumer",
          "PurposeVersionRejected",
          "PurposeVersionArchivedByRevokedDelegation",
          "RiskAnalysisSignedDocumentGenerated"
        ),
      },
      () => Promise.resolve()
    )
    .exhaustive();
}
