import { PurposeCollection } from "pagopa-interop-commons";
import { PurposeEventEnvelopeV1 } from "pagopa-interop-models";

export async function handleMessageV1(
  _message: PurposeEventEnvelopeV1,
  _purposes: PurposeCollection
  // eslint-disable-next-line @typescript-eslint/no-empty-function
): Promise<void> {}
