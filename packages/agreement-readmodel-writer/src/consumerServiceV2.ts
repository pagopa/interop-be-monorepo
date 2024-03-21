import { AgreementCollection, logger } from "pagopa-interop-commons";
import { AgreementEventEnvelopeV2 } from "pagopa-interop-models";

export async function handleMessageV2(
  message: AgreementEventEnvelopeV2,
  _agreements: AgreementCollection
): Promise<void> {
  logger.info(message);
}
