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

        const safeStorageRequest: FileCreationRequest = {
          contentType: "application/gzip",
          documentType: config.safeStorageDocType,
          status: config.safeStorageDocStatus,
          checksumValue: checksum,
        };

        const { uploadUrl, secret, key } = await safeStorageService.createFile(
          safeStorageRequest
        );

        await safeStorageService.uploadFileContent(
          uploadUrl,
          Buffer.from(file),
          "application/pdf",
          secret,
          checksum
        );

        await signatureService.saveDocumentSignatureReference({
          safeStorageId: key,
          fileKind: "RISK_ANALYSIS_DOCUMENT",
          streamId: msg.data.purpose.id,
          subObjectId: msg.data.versionId,
          contentType: "application/gzip",
          path: s3Key,
          prettyname: "",
          fileName,
          version: msg.event_version,
          createdAt: msg.data.purpose.createdAt,
          correlationId: msg.correlation_id ?? "",
        });
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
          "PurposeVersionArchivedByRevokedDelegation"
        ),
      },
      () => Promise.resolve()
    )
    .exhaustive();
}
