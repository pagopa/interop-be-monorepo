import { bffApi } from "pagopa-interop-api-clients";
import { generateMock } from "@anatine/zod-mock";

export const getMockBffApiPurpose = (): bffApi.Purpose =>
  generateMock(bffApi.Purpose);

export const getMockBffApiRiskAnalysisFormConfig =
  (): bffApi.RiskAnalysisFormConfig =>
    generateMock(bffApi.RiskAnalysisFormConfig);
