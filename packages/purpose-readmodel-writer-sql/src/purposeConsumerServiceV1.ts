import {
  PurposeEventEnvelopeV1,
  fromPurposeVersionV1,
  genericInternalError,
  unsafeBrandId,
} from "pagopa-interop-models";
import { match } from "ts-pattern";
import { CustomReadModelService } from "./readModelService.js";
import { getPurposeFromMessage } from "./utils.js";

// TODO: difference from original code -> merged some events together
export async function handleMessageV1(
  message: PurposeEventEnvelopeV1,
  purposeReadModelService: CustomReadModelService
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

        await purposeReadModelService.upsertPurpose({
          data: purpose,
          metadata: { version: msg.version },
        });
      }
    )

    .with(
      { type: "PurposeVersionCreated" },
      { type: "PurposeVersionUpdated" },
      async (msg) => {
        const purposeVersionV1 = msg.data.version;
        if (!purposeVersionV1) {
          throw genericInternalError(
            "PurposeVersion can't be missing in the event message"
          );
        }
        const purposeVersion = fromPurposeVersionV1(purposeVersionV1);

        await purposeReadModelService.upsertPurposeVersion(
          unsafeBrandId(msg.stream_id),
          purposeVersion,
          msg.version
        );
      }
    )
    .with({ type: "PurposeDeleted" }, async (msg) => {
      await purposeReadModelService.deletePurposeById(
        unsafeBrandId(msg.stream_id),
        msg.version
      );
    })
    .with({ type: "PurposeVersionDeleted" }, async (msg) => {
      await purposeReadModelService.deletePurposeVersionById(
        unsafeBrandId(msg.stream_id),
        unsafeBrandId(msg.data.versionId),
        msg.version
      );
    })
    .exhaustive();
}
