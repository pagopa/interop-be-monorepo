import {
  AttributeEventEnvelope,
  fromAttributeV1,
  missingKafkaMessageDataError,
} from "pagopa-interop-models";
import { Logger } from "pagopa-interop-commons";
import { P, match } from "ts-pattern";
import { M2MEventWriterServiceSQL } from "../services/m2mEventWriterServiceSQL.js";
import { toAttributeM2MEventSQL } from "../models/attributeM2MEventAdapterSQL.js";
import { createAttributeM2MEvent } from "../services/event-builders/attributeM2MEventBuilder.js";

export async function handleAttributeEvent(
  decodedMessage: AttributeEventEnvelope,
  eventTimestamp: Date,
  logger: Logger,
  m2mEventWriterService: M2MEventWriterServiceSQL
): Promise<void> {
  return match(decodedMessage)
    .with(
      {
        type: P.union("AttributeAdded"),
      },
      async (event) => {
        if (!event.data.attribute) {
          throw missingKafkaMessageDataError("attribute", event.type);
        }
        const attribute = fromAttributeV1(event.data.attribute);
        logger.info(
          `Creating Attribute M2M Event - type ${event.type}, attributeId ${attribute.id}`
        );
        const m2mEvent = createAttributeM2MEvent(
          attribute,
          event.type,
          eventTimestamp
        );

        await m2mEventWriterService.insertAttributeM2MEvent(
          toAttributeM2MEventSQL(m2mEvent)
        );
      }
    )
    .with(
      {
        type: P.union("MaintenanceAttributeDeleted"),
      },
      () => Promise.resolve(void 0)
    )
    .exhaustive();
}
