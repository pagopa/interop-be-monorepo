import { drizzle } from "drizzle-orm/node-postgres";
import { Attribute, WithMetadata } from "pagopa-interop-models";
import { aggregateAttributeArray } from "pagopa-interop-readmodel";
import { attributeInReadmodelAttribute } from "pagopa-interop-readmodel-models";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function readModelServiceBuilderSQL(
  readModelDB: ReturnType<typeof drizzle>
) {
  return {
    async getAllAttributes(): Promise<Array<WithMetadata<Attribute>>> {
      const res = await readModelDB
        .select()
        .from(attributeInReadmodelAttribute);

      return aggregateAttributeArray(res);
    },
  };
}
