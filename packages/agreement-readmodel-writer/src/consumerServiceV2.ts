import { AgreementCollection } from "pagopa-interop-commons";
import { AgreementEventEnvelopeV2 } from "pagopa-interop-models";

export async function handleMessageV2(
  _message: AgreementEventEnvelopeV2,
  _agreements: AgreementCollection
  // eslint-disable-next-line @typescript-eslint/no-empty-function
): Promise<void> {}
