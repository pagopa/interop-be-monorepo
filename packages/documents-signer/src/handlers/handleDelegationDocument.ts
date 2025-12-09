import path from "path";
import {
  FileManager,
  Logger,
  SafeStorageService,
  SignatureServiceBuilder,
  FileCreationRequest,
} from "pagopa-interop-commons";
import { match, P } from "ts-pattern";
import {
  DelegationEventEnvelopeV2,
  delegationState,
  missingKafkaMessageDataError,
  toDelegationStateV2,
} from "pagopa-interop-models";
import { config } from "../config/config.js";
import { calculateSha256Base64 } from "../utils/checksum.js";

export async function handleDelegationDocument(
  decodedMessage: DelegationEventEnvelopeV2,
  signatureService: SignatureServiceBuilder,
  safeStorageService: SafeStorageService,
  fileManager: FileManager,
  logger: Logger
): Promise<void> {
  await match(decodedMessage)
    .with(
      {
        type: "DelegationContractGenerated",
      },
      async (msg) => {
        if (!msg.data.delegation) {
          throw missingKafkaMessageDataError("delegation", msg.type);
        }
        const isRevokationContractGenerated =
          msg.data.delegation.state ===
          toDelegationStateV2(delegationState.revoked);

        const targetContract = isRevokationContractGenerated
          ? msg.data.delegation?.revocationContract
          : msg.data.delegation?.activationContract;

        if (targetContract?.path) {
          const s3Key = targetContract.path;
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

          const { uploadUrl, secret, key } =
            await safeStorageService.createFile(safeStorageRequest, logger);

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
              fileKind: "DELEGATION_CONTRACT",
              streamId: msg.data.delegation.id,
              subObjectId: "",
              contentType,
              path: targetContract.path,
              prettyname: targetContract.prettyName,
              fileName,
              version: msg.event_version,
              createdAt: msg.data.delegation.createdAt,
              correlationId: msg.correlation_id ?? "",
            },
            logger
          );
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
          "ConsumerDelegationRevoked",
          "ProducerDelegationApproved",
          "ConsumerDelegationApproved",
          "DelegationSignedContractGenerated"
        ),
      },
      () => Promise.resolve()
    )
    .exhaustive();
}
