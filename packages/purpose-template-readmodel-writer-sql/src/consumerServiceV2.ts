import { PurposeTemplateEventEnvelopeV2 } from "pagopa-interop-models";
import { match } from "ts-pattern";
import { PurposeTemplateWriterService } from "./purposeTemplateWriterService.js";

export async function handleMessageV2(
  message: PurposeTemplateEventEnvelopeV2,
  _purposeTemplateWriterService: PurposeTemplateWriterService
): Promise<void> {
  await match(message)
    .with(
      { type: "PurposeTemplateAdded" },
      { type: "PurposeTemplateEServiceLinked" },
      { type: "PurposeTemplateEServiceUnlinked" },
      { type: "PurposeTemplateDraftUpdated" },
      { type: "PurposeTemplateDraftDeleted" },
      { type: "PurposeTemplatePublished" },
      { type: "PurposeTemplateUnsuspended" },
      { type: "PurposeTemplateSuspended" },
      { type: "PurposeTemplateArchived" },
      async (_msg) => {
        await Promise.resolve();
      }
    )
    .exhaustive();
}
