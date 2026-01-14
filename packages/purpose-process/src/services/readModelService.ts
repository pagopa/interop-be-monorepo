import {
  ClientId,
  EServiceId,
  TenantId,
  PurposeVersionState,
} from "pagopa-interop-models";

export type GetPurposesFilters = {
  title?: string;
  eservicesIds: EServiceId[];
  consumersIds: TenantId[];
  clientId?: ClientId;
  producersIds: TenantId[];
  states: PurposeVersionState[];
  excludeDraft: boolean | undefined;
};
