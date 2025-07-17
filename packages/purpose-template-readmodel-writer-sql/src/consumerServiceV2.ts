import {
  PurposeTemplateEventEnvelopeV2,
  missingKafkaMessageDataError,
} from "pagopa-interop-models";
import { match } from "ts-pattern";
import { PurposeTemplateWriterService } from "./purposeTemplateWriterService.js";

export async function handleMessageV2(
  message: PurposeTemplateEventEnvelopeV2,
  _purposeTemplateWriterService: PurposeTemplateWriterService
): Promise<void> {
  const purposeTemplateV2 = message.data.purposeTemplate;
  if (!purposeTemplateV2) {
    throw missingKafkaMessageDataError("purposeTemplate", message.type);
  }
  await match(message)
    .with(
      { type: "PurposeTemplateAdded" },
      { type: "PurposeTemplateArchived" },
      { type: "PurposeTemplateSuspended" },
      { type: "PurposeTemplateActivated" },
      { type: "PurposeTemplateDraftUpdated" },
      { type: "PurposeTemplateDraftDeleted" },
      async (_msg) => {
        await Promise.resolve();
      }
    )
    .exhaustive();
}
