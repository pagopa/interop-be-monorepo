import { bffApi } from "pagopa-interop-api-clients";
import {
  EServiceTemplateId,
  TenantId,
  EServiceTemplateVersionState,
} from "pagopa-interop-models";

export type PersonalDataFilter = bffApi.PersonalDataFilter | undefined;

export type GetEServiceTemplatesFilters = {
  name?: string;
  eserviceTemplatesIds: EServiceTemplateId[];
  creatorsIds: TenantId[];
  states: EServiceTemplateVersionState[];
  personalData?: PersonalDataFilter;
};
