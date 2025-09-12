import { AttributeEventEnvelope } from "pagopa-interop-models";
import { Logger } from "pagopa-interop-commons";
import { P, match } from "ts-pattern";
import { M2MEventWriterServiceSQL } from "../services/m2mEventWriterServiceSQL.js";
import { toNewAttributeM2MEventSQL } from "../models/attributeM2MEventAdapterSQL.js";

export async function handleAttributeEvent(
  decodedMessage: AttributeEventEnvelope,
  eventTimestamp: Date,
  logger: Logger,
  m2mEventWriterService: M2MEventWriterServiceSQL
): Promise<void> {
  return match(decodedMessage)
    .with(
      {
        type: P.union("AttributeAdded", "MaintenanceAttributeDeleted"),
      },
      async (event) => {
        const m2mEvent = toNewAttributeM2MEventSQL(event, eventTimestamp);
        logger.info(
          `Writing AttributeM2MEvent with ID ${m2mEvent.id}, type ${m2mEvent.eventType}, attributeId ${m2mEvent.attributeId}`
        );

        await m2mEventWriterService.insertAttributeM2MEvent(m2mEvent);
      }
    )
    .exhaustive();
}
