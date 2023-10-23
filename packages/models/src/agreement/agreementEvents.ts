import { match } from "ts-pattern";
import {
  AgreementAddedV1,
  AgreementDeletedV1,
} from "../gen/v1/agreement/events.js";

export function agreementEventToBinaryData(event: AgreementEvent): Uint8Array {
  return match(event)
    .with({ type: "AgreementDeleted" }, ({ data }) =>
      AgreementDeletedV1.toBinary(data)
    )
    .with({ type: "AgreementAdded" }, ({ data }) =>
      AgreementAddedV1.toBinary(data)
    )
    .exhaustive();
}

export type AgreementEvent =
  | { type: "AgreementAdded"; data: AgreementAddedV1 }
  | {
      type: "AgreementDeleted";
      data: AgreementDeletedV1;
    };
