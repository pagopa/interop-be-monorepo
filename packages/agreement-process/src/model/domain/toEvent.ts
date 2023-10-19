import { CreateEvent } from "pagopa-interop-commons";
import { AgreementEvent } from "pagopa-interop-models";

export function toCreateEventAgreementDeleted(
  streamId: string,
  version: number
): CreateEvent<AgreementEvent> {
  return {
    streamId,
    version,
    event: {
      type: "AgreementDeleted",
      data: {
        agreementId: streamId,
      },
    },
  };
}
