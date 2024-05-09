import { z } from "zod";
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
