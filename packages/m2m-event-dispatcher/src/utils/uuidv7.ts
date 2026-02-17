import {
  AgreementM2MEventId,
  AttributeM2MEventId,
  ClientM2MEventId,
  DelegationM2MEventId,
  EServiceM2MEventId,
  EServiceTemplateM2MEventId,
  KeyM2MEventId,
  ProducerKeychainM2MEventId,
  ProducerKeyM2MEventId,
  PurposeM2MEventId,
  unsafeBrandId,
  TenantM2MEventId,
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
    | ClientM2MEventId
    | KeyM2MEventId
    | ProducerKeychainM2MEventId
    | ProducerKeyM2MEventId
    | TenantM2MEventId,
>(): ID {
  return unsafeBrandId<ID>(uuidv7());
}
