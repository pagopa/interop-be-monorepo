import {
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
