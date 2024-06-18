import { z } from "zod";
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

export type ApiReversePurposeSeed = z.infer<
  typeof api.schemas.EServicePurposeSeed
>;

export type ApiPurposeCloneSeed = z.infer<typeof api.schemas.PurposeCloneSeed>;

export type ApiFormQuestionRules = z.infer<
  typeof api.schemas.FormConfigQuestionResponse
>;
export type ApiRiskAnalysisFormRules = z.infer<
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

export type ApiPurposeVersionSeed = z.infer<
  typeof api.schemas.PurposeVersionSeed
>;
