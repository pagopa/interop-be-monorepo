import { PurposeCollection } from "pagopa-interop-commons";
import { PurposeEventEnvelopeV2 } from "pagopa-interop-models";

export async function handleMessageV2(
  _message: PurposeEventEnvelopeV2,
  _purposes: PurposeCollection
  // eslint-disable-next-line @typescript-eslint/no-empty-function
): Promise<void> {}
