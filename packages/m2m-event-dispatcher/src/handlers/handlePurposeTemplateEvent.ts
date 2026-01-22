import {
  PurposeTemplateEventEnvelopeV2,
  fromPurposeTemplateV2,
} from "pagopa-interop-models";
import { Logger } from "pagopa-interop-commons";
import { match, P } from "ts-pattern";
import { M2MEventWriterServiceSQL } from "../services/m2mEventWriterServiceSQL.js";
import { assertPurposeTemplateExistsInEvent } from "../services/validators.js";
import { createPurposeTemplateM2MEvent } from "../services/event-builders/purposeTemplateM2MEventBuilder.js";
import { toPurposeTemplateM2MEventSQL } from "../models/purposeTemplateM2MEventAdapterSQL.js";

export async function handlePurposeTemplateEvent(
  decodedMessage: PurposeTemplateEventEnvelopeV2,
  eventTimestamp: Date,
  logger: Logger,
  m2mEventWriterService: M2MEventWriterServiceSQL
): Promise<void> {
  // 1. Validazione e parsing dei dati comuni
  assertPurposeTemplateExistsInEvent(decodedMessage);
  const purposeTemplate = fromPurposeTemplateV2(
    decodedMessage.data.purposeTemplate
  );
  console.log("DEBUG purposeTemplate----", purposeTemplate);
  console.log("DEBUG decodedMessage-----", decodedMessage);

  // 2. Gestione eventi specifici
  return match(decodedMessage)
    .with(
      {
        /**
         * We avoid exposing the unsigned document generation.
         * The user will only be able to see only the signed one.
         */
        type: P.union("RiskAnalysisTemplateDocumentGenerated"),
      },
      () => Promise.resolve(void 0)
    )

    .with(
      {
        type: P.union(
          "PurposeTemplateAdded",
          "PurposeTemplateEServiceLinked",
          "PurposeTemplateEServiceUnlinked",
          "PurposeTemplateAnnotationDocumentAdded",
          "PurposeTemplateAnnotationDocumentUpdated",
          "PurposeTemplateAnnotationDocumentDeleted",
          "PurposeTemplateDraftUpdated",
          "PurposeTemplatePublished",
          "PurposeTemplateSuspended",
          "PurposeTemplateUnsuspended",
          "PurposeTemplateArchived",
          "PurposeTemplateDraftDeleted",
          "RiskAnalysisTemplateSignedDocumentGenerated"
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
          eventTimestamp,
        );

        console.log("DEBUG m2mEvent-----", m2mEvent);

        // Scrittura su DB
        await m2mEventWriterService.insertPurposeTemplateM2MEvent(
          toPurposeTemplateM2MEventSQL(m2mEvent)
        );
      }
    )
    .exhaustive();
}