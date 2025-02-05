import { ProducerJWKKeySQL, genericInternalError } from "pagopa-interop-models";

export const parseClientJWKKeySQL = (
  data: unknown
): ProducerJWKKeySQL | undefined => {
  if (!data) {
    return undefined;
  } else {
    const result = ProducerJWKKeySQL.safeParse(data);
    if (!result.success) {
      throw genericInternalError(
        `Unable to parse producer JWK key item: result ${JSON.stringify(
          result
        )} - data ${JSON.stringify(data)} `
      );
    }
    return result.data;
  }
};
