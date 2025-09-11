import { AttributeEventEnvelope } from "pagopa-interop-models";
import { Logger } from "pagopa-interop-commons";
import { P, match } from "ts-pattern";
import { ReadModelServiceSQL } from "../services/readModelServiceSQL.js";
import { M2MEventServiceSQL } from "../services/m2mEventServiceSQL.js";

export async function handleAttributeEvent(
  decodedMessage: AttributeEventEnvelope,
  _logger: Logger,
  _m2mEventService: M2MEventServiceSQL,
  _readModelService: ReadModelServiceSQL
): Promise<void> {
  return match(decodedMessage)
    .with(
      {
        type: P.union("AttributeAdded", "MaintenanceAttributeDeleted"),
      },
      () => Promise.resolve(void 0)
    )
    .exhaustive();
}
