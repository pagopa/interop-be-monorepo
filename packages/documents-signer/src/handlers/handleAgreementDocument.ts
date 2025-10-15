import path from "path";
import { AgreementEventEnvelopeV2, AgreementV2 } from "pagopa-interop-models";
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
  decodedMessage:
    | AgreementEventEnvelopeV2
    | {
        type: "AgreementContractAdded";
        data: { agreement: AgreementV2 };
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
    .with({ type: "AgreementContractAdded" }, async (event) => {
      if (event.data.agreement.contract) {
        const s3Key = event.data.agreement.contract?.path;
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
          fileKind: "AGREEMENT_CONTRACT",
          streamId: event.data.agreement.id,
          subObjectId: "",
          fileName,
          version: event.event_version,
        });
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
          "AgreementRejected"
        ),
      },
      () => {
        logger.info(
          `No document generation needed for ${decodedMessage.type} message`
        );
      }
    )
    .exhaustive();
}
