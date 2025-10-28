import {
  EServiceTemplateId,
  TenantId,
  EServiceTemplateVersionState,
} from "pagopa-interop-models";

export type GetEServiceTemplatesFilters = {
  name?: string;
  eserviceTemplatesIds: EServiceTemplateId[];
  creatorsIds: TenantId[];
  states: EServiceTemplateVersionState[];
  personalData?: boolean;
};
