import path from "path";
import {
  AgreementEventEnvelopeV2,
  missingKafkaMessageDataError,
} from "pagopa-interop-models";
import { match, P } from "ts-pattern";
import {
  FileManager,
  Logger,
  SignatureServiceBuilder,
  SafeStorageService,
  FileCreationRequest,
} from "pagopa-interop-commons";
import { config } from "../config/config.js";
import { calculateSha256Base64 } from "../utils/checksum.js";

export async function handleAgreementDocument(
  decodedMessage: AgreementEventEnvelopeV2,
  signatureService: SignatureServiceBuilder,
  safeStorageService: SafeStorageService,
  fileManager: FileManager,
  logger: Logger
): Promise<void> {
  await match(decodedMessage)
    .with({ type: "AgreementContractGenerated" }, async (msg) => {
      if (!msg.data.agreement) {
        throw missingKafkaMessageDataError("agreement", msg.type);
      }
      if (msg.data.agreement.contract) {
        const s3Key = msg.data.agreement.contract.path;
        const file: Uint8Array = await fileManager.get(
          config.s3Bucket,
          s3Key,
          logger
        );

        const fileName = path.basename(s3Key);
        const checksum = await calculateSha256Base64(Buffer.from(file));

        const safeStorageRequest: FileCreationRequest = {
          contentType: "application/pdf",
          documentType: config.safeStorageDocType,
          status: config.safeStorageDocStatus,
          checksumValue: checksum,
        };

        const { uploadUrl, secret, key } = await safeStorageService.createFile(
          safeStorageRequest,
          logger
        );

        await safeStorageService.uploadFileContent(
          uploadUrl,
          Buffer.from(file),
          "application/pdf",
          secret,
          checksum,
          logger
        );

        await signatureService.saveDocumentSignatureReference(
          {
            safeStorageId: key,
            fileKind: "AGREEMENT_CONTRACT",
            streamId: msg.data.agreement.id,
            subObjectId: "",
            contentType: "application/pdf",
            path: msg.data.agreement.contract.path,
            prettyname: msg.data.agreement.contract.prettyName,
            fileName,
            version: msg.event_version,
            correlationId: msg.correlation_id ?? "",
            createdAt: msg.data.agreement.createdAt,
          },
          logger
        );
      }
    })
    .with(
      {
        type: P.union(
          "AgreementAdded",
          "AgreementDeleted",
          "AgreementActivated",
          "AgreementUpgraded",
          "DraftAgreementUpdated",
          "AgreementArchivedByUpgrade",
          "AgreementConsumerDocumentAdded",
          "AgreementConsumerDocumentRemoved",
          "AgreementSetDraftByPlatform",
          "AgreementSetMissingCertifiedAttributesByPlatform",
          "AgreementDeletedByRevokedDelegation",
          "AgreementArchivedByRevokedDelegation",
          "AgreementSubmitted",
          "AgreementUnsuspendedByProducer",
          "AgreementUnsuspendedByConsumer",
          "AgreementUnsuspendedByPlatform",
          "AgreementArchivedByConsumer",
          "AgreementSuspendedByProducer",
          "AgreementSuspendedByConsumer",
          "AgreementSuspendedByPlatform",
          "AgreementRejected",
          "AgreementSignedContractGenerated"
        ),
      },
      () => Promise.resolve()
    )
    .exhaustive();
}
