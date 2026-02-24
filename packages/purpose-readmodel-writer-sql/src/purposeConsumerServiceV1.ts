import {
  PurposeEventEnvelopeV1,
  fromPurposeVersionV1,
  missingKafkaMessageDataError,
  unsafeBrandId,
} from "pagopa-interop-models";
import { match } from "ts-pattern";
import { PurposeWriterService } from "./purposeWriterService.js";
import { getPurposeFromMessage } from "./utils.js";

export async function handleMessageV1(
  message: PurposeEventEnvelopeV1,
  purposeWriterService: PurposeWriterService
): Promise<void> {
  await match(message)
    .with(
      { type: "PurposeCreated" },
      { type: "PurposeUpdated" },
      { type: "PurposeVersionActivated" },
      { type: "PurposeVersionSuspended" },
      { type: "PurposeVersionArchived" },
      { type: "PurposeVersionWaitedForApproval" },
      { type: "PurposeVersionRejected" },
      async (msg) => {
        const purpose = getPurposeFromMessage(msg.data.purpose);

        await purposeWriterService.upsertPurpose(purpose, msg.version);
      }
    )
    .with(
      { type: "PurposeVersionCreated" },
      { type: "PurposeVersionUpdated" },
      async (msg) => {
        const purposeVersionV1 = msg.data.version;
        if (!purposeVersionV1) {
          throw missingKafkaMessageDataError("version", msg.type);
        }
        const purposeVersion = fromPurposeVersionV1(purposeVersionV1);

        await purposeWriterService.upsertPurposeVersion(
          unsafeBrandId(msg.stream_id),
          purposeVersion,
          msg.version
        );
      }
    )
    .with({ type: "PurposeDeleted" }, async (msg) => {
      await purposeWriterService.deletePurposeById(
        unsafeBrandId(msg.stream_id),
        msg.version
      );
    })
    .with({ type: "PurposeVersionDeleted" }, async (msg) => {
      await purposeWriterService.deletePurposeVersionById(
        unsafeBrandId(msg.stream_id),
        unsafeBrandId(msg.data.versionId),
        msg.version
      );
    })
    .exhaustive();
}
