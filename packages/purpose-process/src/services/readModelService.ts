import {
  ClientId,
  EServiceId,
  TenantId,
  PurposeVersionState,
  PurposeId,
} from "pagopa-interop-models";

export type GetPurposesFilters = {
  title?: string;
  eservicesIds: EServiceId[];
  consumersIds: TenantId[];
  producersIds: TenantId[];
  purposesIds: PurposeId[];
  states: PurposeVersionState[];
  excludeDraft: boolean | undefined;
};

export type GetPurposesInputFilters = GetPurposesFilters & {
  clientId?: ClientId;
};
