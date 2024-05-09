import { z } from "zod";
import { ZodiosQueryParamsByPath } from "@zodios/core";
import * as api from "../generated/api.js";

export type ApiRiskAnalysisForm = z.infer<typeof api.schemas.RiskAnalysisForm>;
export type ApiPurposeVersion = z.infer<typeof api.schemas.PurposeVersion>;
export type ApiPurpose = z.infer<typeof api.schemas.Purpose>;
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
