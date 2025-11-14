import {
  AgreementM2MEventId,
  AttributeM2MEventId,
  DelegationM2MEventId,
  EServiceM2MEventId,
  EServiceTemplateM2MEventId,
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
    | DelegationM2MEventId
    | EServiceTemplateM2MEventId
>(): ID {
  return unsafeBrandId<ID>(uuidv7());
}
