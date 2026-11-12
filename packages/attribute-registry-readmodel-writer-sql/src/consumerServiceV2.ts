import {
  AttributeEventEnvelopeV2,
  fromRegistryAttributeV2,
  missingKafkaMessageDataError,
} from "pagopa-interop-models";
import { match } from "ts-pattern";

import { AttributeWriterService } from "./attributeWriterService.js";

export async function handleMessageV2(
  message: AttributeEventEnvelopeV2,
  attributeWriterService: AttributeWriterService
): Promise<void> {
  await match(message)
    .with({ type: "AttributeSubunitPropagationUpdated" }, async (msg) => {
      if (!msg.data.attribute) {
        throw missingKafkaMessageDataError("attribute", msg.type);
      }

      await attributeWriterService.upsertAttribute(
        fromRegistryAttributeV2(msg.data.attribute),
        msg.version
      );
    })
    .exhaustive();
}
