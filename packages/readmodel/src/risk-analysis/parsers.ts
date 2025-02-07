import {
  genericInternalError,
  PurposeRiskAnalysisAnswerSQL,
  PurposeRiskAnalysisFormSQL,
} from "pagopa-interop-models";

export const parsePurposeRiskAnalysisFormSQL = (
  data: unknown
): PurposeRiskAnalysisFormSQL | undefined => {
  if (!data) {
    return undefined;
  } else {
    const result = PurposeRiskAnalysisFormSQL.safeParse(data);
    if (!result.success) {
      throw genericInternalError(
        `Unable to parse purpose risk analysis form SQL item: result ${JSON.stringify(
          result
        )} - data ${JSON.stringify(data)} `
      );
    }
    return result.data;
  }
};

export const parsePurposeRiskAnalysisAnswerSQL = (
  data: unknown
): PurposeRiskAnalysisAnswerSQL | undefined => {
  if (!data) {
    return undefined;
  } else {
    const result = PurposeRiskAnalysisAnswerSQL.safeParse(data);
    if (!result.success) {
      throw genericInternalError(
        `Unable to parse purpose risk analysis answer SQL item: result ${JSON.stringify(
          result
        )} - data ${JSON.stringify(data)} `
      );
    }
    return result.data;
  }
};
