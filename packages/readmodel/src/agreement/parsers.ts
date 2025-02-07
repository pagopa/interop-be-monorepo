import {
  AgreementAttribute,
  AgreementDocument,
  AgreementSQL,
  AgreementStamp,
  genericInternalError,
} from "pagopa-interop-models";

export const parseAttributeSQL = (data: unknown): AgreementSQL | undefined => {
  if (!data) {
    return undefined;
  } else {
    const result = AgreementSQL.safeParse(data);
    if (!result.success) {
      throw genericInternalError(
        `Unable to parse agreement SQL item: result ${JSON.stringify(
          result
        )} - data ${JSON.stringify(data)} `
      );
    }
    return result.data;
  }
};

export const parseAgreementStampSQL = (
  data: unknown
): AgreementStamp | undefined => {
  if (!data) {
    return undefined;
  } else {
    const result = AgreementStamp.safeParse(data);
    if (!result.success) {
      throw genericInternalError(
        `Unable to parse agreement stamp SQL item: result ${JSON.stringify(
          result
        )} - data ${JSON.stringify(data)} `
      );
    }
    return result.data;
  }
};

export const parseAgreementAttributeSQL = (
  data: unknown
): AgreementAttribute | undefined => {
  if (!data) {
    return undefined;
  } else {
    const result = AgreementAttribute.safeParse(data);
    if (!result.success) {
      throw genericInternalError(
        `Unable to parse agreement attribute SQL item: result ${JSON.stringify(
          result
        )} - data ${JSON.stringify(data)} `
      );
    }
    return result.data;
  }
};

export const parseAgreementDocumentSQL = (
  data: unknown
): AgreementDocument | undefined => {
  if (!data) {
    return undefined;
  } else {
    const result = AgreementDocument.safeParse(data);
    if (!result.success) {
      throw genericInternalError(
        `Unable to parse agreement document SQL item: result ${JSON.stringify(
          result
        )} - data ${JSON.stringify(data)} `
      );
    }
    return result.data;
  }
};
