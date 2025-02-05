import {
  genericInternalError,
  ProducerKeychainEServiceSQL,
  ProducerKeychainKeySQL,
  ProducerKeychainSQL,
  ProducerKeychainUserSQL,
} from "pagopa-interop-models";

export const parseProducerKeychainSQL = (
  data: unknown
): ProducerKeychainSQL | undefined => {
  if (!data) {
    return undefined;
  } else {
    const result = ProducerKeychainSQL.safeParse(data);
    if (!result.success) {
      throw genericInternalError(
        `Unable to parse producer keychain SQL item: result ${JSON.stringify(
          result
        )} - data ${JSON.stringify(data)} `
      );
    }
    return result.data;
  }
};

export const parseProducerKeychainUserSQL = (
  data: unknown
): ProducerKeychainUserSQL | undefined => {
  if (!data) {
    return undefined;
  } else {
    const result = ProducerKeychainUserSQL.safeParse(data);
    if (!result.success) {
      throw genericInternalError(
        `Unable to parse producer keychain user SQL item: result ${JSON.stringify(
          result
        )} - data ${JSON.stringify(data)} `
      );
    }
    return result.data;
  }
};

export const parseProducerKeychainEServiceSQL = (
  data: unknown
): ProducerKeychainEServiceSQL | undefined => {
  if (!data) {
    return undefined;
  } else {
    const result = ProducerKeychainEServiceSQL.safeParse(data);
    if (!result.success) {
      throw genericInternalError(
        `Unable to parse producer keychain e-service SQL item: result ${JSON.stringify(
          result
        )} - data ${JSON.stringify(data)} `
      );
    }
    return result.data;
  }
};

export const parseProducerKeychainKeySQL = (
  data: unknown
): ProducerKeychainKeySQL | undefined => {
  if (!data) {
    return undefined;
  } else {
    const result = ProducerKeychainKeySQL.safeParse(data);
    if (!result.success) {
      throw genericInternalError(
        `Unable to parse producer keychain key SQL item: result ${JSON.stringify(
          result
        )} - data ${JSON.stringify(data)} `
      );
    }
    return result.data;
  }
};
