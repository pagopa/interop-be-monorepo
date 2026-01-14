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
  producersIds: TenantId[];
  states: PurposeVersionState[];
  excludeDraft: boolean | undefined;
};

export type GetPurposesInputFilters = GetPurposesFilters & {
  clientId?: ClientId;
};
