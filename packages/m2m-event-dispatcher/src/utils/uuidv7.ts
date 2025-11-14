import {
  AgreementM2MEventId,
  AttributeM2MEventId,
  EServiceM2MEventId,
  PurposeM2MEventId,
  unsafeBrandId,
} from "pagopa-interop-models";
import { v7 as uuidv7 } from "uuid";

export function generateM2MEventId<
  ID extends
    | AttributeM2MEventId
    | EServiceM2MEventId
    | AgreementM2MEventId
    | PurposeM2MEventId
>(): ID {
  return unsafeBrandId<ID>(uuidv7());
}
