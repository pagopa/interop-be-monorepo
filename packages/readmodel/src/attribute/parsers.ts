import { AttributeSQL, genericInternalError } from "pagopa-interop-models";

export const parseAttributeSQL = (data: unknown): AttributeSQL | undefined => {
  if (!data) {
    return undefined;
  } else {
    const result = AttributeSQL.safeParse(data);
    if (!result.success) {
      throw genericInternalError(
        `Unable to parse attribute item: result ${JSON.stringify(
          result
        )} - data ${JSON.stringify(data)} `
      );
    }
    return result.data;
  }
};
