import { z } from "zod";
import {
  EServiceId,
  PurposeVersionState,
  TenantId,
} from "pagopa-interop-models";
import * as api from "../generated/api.js";

export type ApiRiskAnalysisForm = z.infer<typeof api.schemas.RiskAnalysisForm>;
export type ApiPurposeVersion = z.infer<typeof api.schemas.PurposeVersion>;
export type ApiPurpose = z.infer<typeof api.schemas.Purpose>;
export type ApiPurposeSeed = z.infer<typeof api.schemas.PurposeSeed>;

export type ApiPurposeVersionState = z.infer<
  typeof api.schemas.PurposeVersionState
>;
export type ApiPurposeVersionDocument = z.infer<
  typeof api.schemas.PurposeVersionDocument
>;

export type ApiPurposeUpdateContent = z.infer<
  typeof api.schemas.PurposeUpdateContent
>;

export type ApiRiskAnalysisFormSeed = z.infer<
  typeof api.schemas.RiskAnalysisFormSeed
>;

export type ApiReversePurposeUpdateContent = z.infer<
  typeof api.schemas.ReversePurposeUpdateContent
>;

export type ApiGetPurposesFilters = {
  name?: string;
  eservicesIds: EServiceId[];
  consumersIds: TenantId[];
  producersIds: TenantId[];
  states: PurposeVersionState[];
  excludeDraft: boolean | undefined;
};

export type ApiReversePurposeSeed = z.infer<
  typeof api.schemas.ReversePurposeSeed
>;
