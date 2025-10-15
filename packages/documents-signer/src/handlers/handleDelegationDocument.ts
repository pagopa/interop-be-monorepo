import path from "path";
import {
  FileManager,
  Logger,
  SafeStorageService,
  SignatureServiceBuilder,
  FileCreationRequest,
} from "pagopa-interop-commons";
import { match, P } from "ts-pattern";
import { DelegationEventV2 } from "pagopa-interop-models";
import { config } from "../config/config.js";
import { calculateSha256Base64 } from "../utils/checksum.js";

export async function handleDelegationDocument(
  decodedMessage: DelegationEventV2,
  signatureService: SignatureServiceBuilder,
  safeStorageService: SafeStorageService,
  fileManager: FileManager,
  logger: Logger
): Promise<void> {
  await match(decodedMessage)
    .with(
      {
        type: P.union(
          "ProducerDelegationApproved",
          "ConsumerDelegationApproved"
        ),
      },
      async (event) => {
        if (event.data.delegation?.activationContract?.path) {
          const s3Key = event.data.delegation.activationContract.path;
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

          const { uploadUrl, secret, key } =
            await safeStorageService.createFile(safeStorageRequest);

          await safeStorageService.uploadFileContent(
            uploadUrl,
            Buffer.from(file),
            "application/pdf",
            secret,
            checksum
          );

          await signatureService.saveDocumentSignatureReference({
            safeStorageId: key,
            fileKind: "DELEGATION_CONTRACT",
            streamId: event.data.delegation.id,
            subObjectId: "",
            fileName,
            version: event.event_version,
          });
        }
      }
    )
    .with(
      {
        type: P.union(
          "ProducerDelegationSubmitted",
          "ProducerDelegationRejected",
          "ProducerDelegationRevoked",
          "ConsumerDelegationSubmitted",
          "ConsumerDelegationRejected",
          "ConsumerDelegationRevoked"
        ),
      },
      (event) => {
        logger.info(`Skipping not relevant event type: ${event.type}`);
      }
    )
    .exhaustive();
}
