import {
  PurposeTemplateEventEnvelope,
  fromPurposeTemplateV2,
} from "pagopa-interop-models";
import { Logger } from "pagopa-interop-commons";
import { match, P } from "ts-pattern";
import { M2MEventWriterServiceSQL } from "../services/m2mEventWriterServiceSQL.js";
import { assertPurposeTemplateExistsInEvent } from "../services/validators.js";
import { createPurposeTemplateM2MEvent } from "../services/event-builders/purposeTemplateM2MEventBuilder.js";
import { toPurposeTemplateM2MEventSQL } from "../models/purposeTemplateM2MEventAdapterSQL.js";

export async function handlePurposeTemplateEvent(
  decodedMessage: PurposeTemplateEventEnvelope,
  eventTimestamp: Date,
  logger: Logger,
  m2mEventWriterService: M2MEventWriterServiceSQL
): Promise<void> {
  assertPurposeTemplateExistsInEvent(decodedMessage);

  const purposeTemplate = fromPurposeTemplateV2(
    decodedMessage.data.purposeTemplate
  );

  return match(decodedMessage)
    .with(
      {
        type: "RiskAnalysisTemplateDocumentGenerated",
      },
      () => Promise.resolve(void 0)
    )
    .with(
      {
        type: P.union(
          "PurposeTemplateAdded",
          "PurposeTemplateAnnotationDocumentAdded",
          "PurposeTemplateAnnotationDocumentUpdated",
          "PurposeTemplateAnnotationDocumentDeleted",
          "PurposeTemplateDraftUpdated",
          "PurposeTemplatePublished",
          "PurposeTemplateSuspended",
          "PurposeTemplateUnsuspended",
          "PurposeTemplateArchived",
          "PurposeTemplateDraftDeleted",
          "RiskAnalysisTemplateSignedDocumentGenerated",
          "PurposeTemplateEServiceLinked",
          "PurposeTemplateEServiceUnlinked"
        ),
      },
      async (event) => {
        logger.info(
          `Creating Purpose Template M2M Event - type ${event.type}, purposeTemplateId ${purposeTemplate.id}`
        );

        const m2mEvent = await createPurposeTemplateM2MEvent(
          purposeTemplate,
          event.version,
          event.type,
          eventTimestamp
        );

        await m2mEventWriterService.insertPurposeTemplateM2MEvent(
          toPurposeTemplateM2MEventSQL(m2mEvent)
        );
      }
    )
    .exhaustive();
}
