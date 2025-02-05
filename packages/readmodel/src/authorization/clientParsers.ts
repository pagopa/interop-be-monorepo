import {
  ClientKeySQL,
  ClientPurposeSQL,
  ClientSQL,
  ClientUserSQL,
  genericInternalError,
} from "pagopa-interop-models";

export const parseClientSQL = (data: unknown): ClientSQL | undefined => {
  if (!data) {
    return undefined;
  } else {
    const result = ClientSQL.safeParse(data);
    if (!result.success) {
      throw genericInternalError(
        `Unable to parse client SQL item: result ${JSON.stringify(
          result
        )} - data ${JSON.stringify(data)} `
      );
    }
    return result.data;
  }
};

export const parseClientUserSQL = (
  data: unknown
): ClientUserSQL | undefined => {
  if (!data) {
    return undefined;
  } else {
    const result = ClientUserSQL.safeParse(data);
    if (!result.success) {
      throw genericInternalError(
        `Unable to parse client user SQL item: result ${JSON.stringify(
          result
        )} - data ${JSON.stringify(data)} `
      );
    }
    return result.data;
  }
};

export const parseClientPurposeSQL = (
  data: unknown
): ClientPurposeSQL | undefined => {
  if (!data) {
    return undefined;
  } else {
    const result = ClientPurposeSQL.safeParse(data);
    if (!result.success) {
      throw genericInternalError(
        `Unable to parse client purpose SQL item: result ${JSON.stringify(
          result
        )} - data ${JSON.stringify(data)} `
      );
    }
    return result.data;
  }
};

export const parseClientKeySQL = (data: unknown): ClientKeySQL | undefined => {
  if (!data) {
    return undefined;
  } else {
    const result = ClientKeySQL.safeParse(data);
    if (!result.success) {
      throw genericInternalError(
        `Unable to parse client key SQL item: result ${JSON.stringify(
          result
        )} - data ${JSON.stringify(data)} `
      );
    }
    return result.data;
  }
};
