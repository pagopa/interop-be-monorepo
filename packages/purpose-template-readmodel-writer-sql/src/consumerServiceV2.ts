import {
  fromPurposeTemplateV2,
  missingKafkaMessageDataError,
  PurposeTemplateEventEnvelopeV2,
  unsafeBrandId,
} from "pagopa-interop-models";
import { match } from "ts-pattern";
import { PurposeTemplateWriterService } from "./purposeTemplateWriterService.js";

export async function handleMessageV2(
  message: PurposeTemplateEventEnvelopeV2,
  purposeTemplateWriterService: PurposeTemplateWriterService
): Promise<void> {
  await match(message)
    .with(
      { type: "PurposeTemplateAdded" },
      { type: "PurposeTemplateDraftUpdated" },
      { type: "PurposeTemplatePublished" },
      { type: "PurposeTemplateUnsuspended" },
      { type: "PurposeTemplateSuspended" },
      { type: "PurposeTemplateArchived" },
      async (msg) => {
        if (!msg.data.purposeTemplate) {
          throw missingKafkaMessageDataError("purposeTemplate", msg.type);
        }

        await purposeTemplateWriterService.upsertPurposeTemplate(
          fromPurposeTemplateV2(msg.data.purposeTemplate),
          msg.version
        );
      }
    )
    .with({ type: "PurposeTemplateDraftDeleted" }, async (msg) => {
      if (!msg.data.purposeTemplate) {
        throw missingKafkaMessageDataError("purposeTemplate", msg.type);
      }

      const purposeTemplate = fromPurposeTemplateV2(msg.data.purposeTemplate);

      await purposeTemplateWriterService.deletePurposeTemplateById(
        purposeTemplate.id,
        msg.version
      );
    })
    .with({ type: "PurposeTemplateEServiceLinked" }, async (msg) => {
      await purposeTemplateWriterService.upsertPurposeTemplateEServiceDescriptor(
        {
          purposeTemplateId: unsafeBrandId(msg.data.purposeTemplateId),
          eserviceId: unsafeBrandId(msg.data.eserviceId),
          descriptorId: unsafeBrandId(msg.data.descriptorId),
          createdAt: new Date(),
        },
        msg.version
      );
    })
    .with({ type: "PurposeTemplateEServiceUnlinked" }, async (msg) => {
      await purposeTemplateWriterService.deletePurposeTemplateEServiceDescriptorsByEServiceIdAndDescriptorId(
        {
          purposeTemplateId: unsafeBrandId(msg.data.purposeTemplateId),
          eserviceId: unsafeBrandId(msg.data.eserviceId),
          descriptorId: unsafeBrandId(msg.data.descriptorId),
          metadataVersion: msg.version,
        }
      );
    })
    .exhaustive();
}
