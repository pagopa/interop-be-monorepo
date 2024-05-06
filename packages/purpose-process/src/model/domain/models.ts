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

export type ApiPurposeCloneSeed = z.infer<typeof api.schemas.PurposeCloneSeed>;

export type ApiFormConfigQuestion = z.infer<
  typeof api.schemas.FormConfigQuestionResponse
>;
export type ApiRiskAnalysisFormConfig = z.infer<
  typeof api.schemas.RiskAnalysisFormConfigResponse
>;

export type ApiLocalizedText = z.infer<
  typeof api.schemas.LocalizedTextResponse
>;

export type ApiDataType = z.infer<typeof api.schemas.DataTypeResponse>;

export type ApiDependency = z.infer<typeof api.schemas.DependencyResponse>;

export type ApiHideOptionConfig = z.infer<
  typeof api.schemas.HideOptionResponse
>;

export type ApiLabeledValue = z.infer<typeof api.schemas.LabeledValueResponse>;
