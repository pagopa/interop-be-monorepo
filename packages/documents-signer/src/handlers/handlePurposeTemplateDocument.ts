import path from "path";
import {
  genericInternalError,
  missingKafkaMessageDataError,
  PurposeTemplateEventEnvelopeV2,
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

export async function handlePurposeTemplateDocument(
  decodedMessage: PurposeTemplateEventEnvelopeV2,
  signatureService: SignatureServiceBuilder,
  safeStorageService: SafeStorageService,
  fileManager: FileManager,
  logger: Logger
): Promise<void> {
  await match(decodedMessage)
    .with({ type: "RiskAnalysisTemplateDocumentGenerated" }, async (msg) => {
      if (!msg.data.purposeTemplate) {
        throw missingKafkaMessageDataError("purpose", msg.type);
      }
      const purposeTemplate = msg.data.purposeTemplate;

      if (!purposeTemplate.purposeRiskAnalysisForm?.document) {
        throw genericInternalError(
          `Handle Purpose Template Document - riskAnalysis document not found for purpose template id: ${purposeTemplate.id}`
        );
      }
      const s3Key = purposeTemplate.purposeRiskAnalysisForm?.document?.path;

      logger.info(
        `Processing and signing riskAnalysis template file with key ${s3Key}`
      );

      if (!s3Key) {
        throw genericInternalError(
          `Handle Purpose Template Document - riskAnalysis path not found for purpose template id: ${purposeTemplate.id}`
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
          fileKind: "RISK_ANALYSIS_TEMPLATE_DOCUMENT",
          streamId: purposeTemplate.id,
          subObjectId: "",
          contentType,
          path: s3Key,
          prettyname:
            purposeTemplate.purposeRiskAnalysisForm.document.prettyName,
          fileName,
          version: msg.event_version,
          createdAt: purposeTemplate.createdAt,
          correlationId: msg.correlation_id ?? "",
        },
        logger
      );
    })
    .with(
      {
        type: P.union(
          "PurposeTemplatePublished",
          "PurposeTemplateAdded",
          "PurposeTemplateAnnotationDocumentAdded",
          "PurposeTemplateAnnotationDocumentDeleted",
          "PurposeTemplateAnnotationDocumentUpdated",
          "PurposeTemplateArchived",
          "PurposeTemplateDraftDeleted",
          "PurposeTemplateDraftUpdated",
          "PurposeTemplateEServiceLinked",
          "PurposeTemplateEServiceUnlinked",
          "PurposeTemplateSuspended",
          "PurposeTemplateUnsuspended",
          "RiskAnalysisTemplateSignedDocumentGenerated"
        ),
      },
      () => Promise.resolve()
    )
    .exhaustive();
}
