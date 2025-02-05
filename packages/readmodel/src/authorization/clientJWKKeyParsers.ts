import { ClientJWKKeySQL, genericInternalError } from "pagopa-interop-models";

export const parseClientJWKKeySQL = (
  data: unknown
): ClientJWKKeySQL | undefined => {
  if (!data) {
    return undefined;
  } else {
    const result = ClientJWKKeySQL.safeParse(data);
    if (!result.success) {
      throw genericInternalError(
        `Unable to parse client JWK key item: result ${JSON.stringify(
          result
        )} - data ${JSON.stringify(data)} `
      );
    }
    return result.data;
  }
};
