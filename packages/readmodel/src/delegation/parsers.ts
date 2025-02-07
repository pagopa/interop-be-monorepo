import {
  DelegationContractDocumentSQL,
  DelegationSQL,
  DelegationStampSQL,
  genericInternalError,
} from "pagopa-interop-models";

export const parseDelegationSQL = (
  data: unknown
): DelegationSQL | undefined => {
  if (!data) {
    return undefined;
  } else {
    const result = DelegationSQL.safeParse(data);
    if (!result.success) {
      throw genericInternalError(
        `Unable to parse delegation SQL item: result ${JSON.stringify(
          result
        )} - data ${JSON.stringify(data)} `
      );
    }
    return result.data;
  }
};

export const parseDelegationStampSQL = (
  data: unknown
): DelegationStampSQL | undefined => {
  if (!data) {
    return undefined;
  } else {
    const result = DelegationStampSQL.safeParse(data);
    if (!result.success) {
      throw genericInternalError(
        `Unable to parse delegation stamp SQL item: result ${JSON.stringify(
          result
        )} - data ${JSON.stringify(data)} `
      );
    }
    return result.data;
  }
};

export const parseDelegationContractDocumentSQL = (
  data: unknown
): DelegationContractDocumentSQL | undefined => {
  if (!data) {
    return undefined;
  } else {
    const result = DelegationContractDocumentSQL.safeParse(data);
    if (!result.success) {
      throw genericInternalError(
        `Unable to parse delegation contract document SQL item: result ${JSON.stringify(
          result
        )} - data ${JSON.stringify(data)} `
      );
    }
    return result.data;
  }
};
