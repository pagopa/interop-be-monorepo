import {
  genericInternalError,
  PurposeSQL,
  PurposeVersionDocumentSQL,
  PurposeVersionSQL,
} from "pagopa-interop-models";

export const parsePurposeSQL = (data: unknown): PurposeSQL | undefined => {
  if (!data) {
    return undefined;
  } else {
    const result = PurposeSQL.safeParse(data);
    if (!result.success) {
      throw genericInternalError(
        `Unable to parse purpose SQL item: result ${JSON.stringify(
          result
        )} - data ${JSON.stringify(data)} `
      );
    }
    return result.data;
  }
};

export const parsePurposeVersionSQL = (
  data: unknown
): PurposeVersionSQL | undefined => {
  if (!data) {
    return undefined;
  } else {
    const result = PurposeVersionSQL.safeParse(data);
    if (!result.success) {
      throw genericInternalError(
        `Unable to parse purpose version SQL item: result ${JSON.stringify(
          result
        )} - data ${JSON.stringify(data)} `
      );
    }
    return result.data;
  }
};

export const parsePurposeVersionDocumentSQL = (
  data: unknown
): PurposeVersionDocumentSQL | undefined => {
  if (!data) {
    return undefined;
  } else {
    const result = PurposeVersionDocumentSQL.safeParse(data);
    if (!result.success) {
      throw genericInternalError(
        `Unable to parse purpose version document SQL item: result ${JSON.stringify(
          result
        )} - data ${JSON.stringify(data)} `
      );
    }
    return result.data;
  }
};
