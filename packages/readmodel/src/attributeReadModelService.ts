import { eq, SQL } from "drizzle-orm";
import {
  Attribute,
  AttributeId,
  genericInternalError,
  WithMetadata,
} from "pagopa-interop-models";
import {
  attributeInReadmodelAttribute,
  DrizzleReturnType,
} from "pagopa-interop-readmodel-models";
import {
  aggregateAttribute,
  aggregateAttributeArray,
} from "./attribute/aggregators.js";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function attributeReadModelServiceBuilder(db: DrizzleReturnType) {
  return {
    async getAttributeById(
      attributeId: AttributeId
    ): Promise<WithMetadata<Attribute> | undefined> {
      return await this.getAttributeByFilter(
        eq(attributeInReadmodelAttribute.id, attributeId)
      );
    },
    async getAttributeByFilter(
      filter: SQL | undefined
    ): Promise<WithMetadata<Attribute> | undefined> {
      if (filter === undefined) {
        throw genericInternalError("Filter cannot be undefined");
      }

      const queryResult = await db
        .select()
        .from(attributeInReadmodelAttribute)
        .where(filter);

      if (queryResult.length === 0) {
        return undefined;
      }

      return aggregateAttribute(queryResult[0]);
    },
    async getAttributesByFilter(
      filter: SQL | undefined
    ): Promise<Array<WithMetadata<Attribute>>> {
      if (filter === undefined) {
        throw genericInternalError("Filter cannot be undefined");
      }

      const queryResult = await db
        .select()
        .from(attributeInReadmodelAttribute)
        .where(filter);

      return aggregateAttributeArray(queryResult);
    },
  };
}
export type AttributeReadModelService = ReturnType<
  typeof attributeReadModelServiceBuilder
>;
