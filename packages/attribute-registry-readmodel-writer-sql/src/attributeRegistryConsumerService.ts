import {
  AttributeEventEnvelopeV1,
  fromAttributeV1,
  missingKafkaMessageDataError,
} from "pagopa-interop-models";
import { match } from "ts-pattern";

import { AttributeWriterService } from "./attributeWriterService.js";

export async function handleMessage(
  message: AttributeEventEnvelopeV1,
  attributeWriterService: AttributeWriterService
): Promise<void> {
  await match(message)
    .with({ type: "AttributeAdded" }, async (msg) => {
      if (!msg.data.attribute) {
        throw missingKafkaMessageDataError("attribute", message.type);
      }

      await attributeWriterService.upsertAttribute(
        fromAttributeV1(msg.data.attribute),
        msg.version
      );
    })
    .exhaustive();
}
