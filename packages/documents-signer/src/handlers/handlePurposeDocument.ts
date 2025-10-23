import path from "path";
import {
  genericInternalError,
  PurposeEventEnvelopeV2,
  PurposeV2,
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
  decodedMessage:
    | PurposeEventEnvelopeV2
    | {
        type: "RiskAnalysisDocumentGenerated";
        data: { purpose: PurposeV2; versionId: string };
        event_version: number;
        version: number;
        stream_id: string;
      }, // TO DO: Remove once implemented the type
  signatureService: SignatureServiceBuilder,
  safeStorageService: SafeStorageService,
  fileManager: FileManager,
  logger: Logger
): Promise<void> {
  await match(decodedMessage)
    .with({ type: "RiskAnalysisDocumentGenerated" }, async (event) => {
      if (event.data.purpose.versions) {
        const purposeVersion = event.data.purpose.versions.find(
          (v) => v.id === event.data.versionId
        );

        if (!purposeVersion) {
          throw genericInternalError(
            `Handle Purpose Document - version not found for id: ${event.data.versionId}`
          );
        }

        const s3Key = purposeVersion.riskAnalysis?.path;

        if (!s3Key) {
          throw genericInternalError(
            `Handle Purpose Document - riskAnalysis path not found for id: ${event.data.versionId}`
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
          streamId: event.data.purpose.id,
          subObjectId: event.data.versionId,
          contentType: "application/gzip",
          path: s3Key,
          prettyname: "",
          fileName,
          version: event.event_version,
          createdAt: event.data.purpose.createdAt,
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
