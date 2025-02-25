import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Attribute, AttributeId, WithMetadata } from "pagopa-interop-models";
import { attributeInReadmodelAttribute } from "pagopa-interop-readmodel-models";
import { splitAttributeIntoObjectsSQL } from "./attribute/splitters.js";
import { aggregateAttribute } from "./attribute/aggregators.js";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function readModelServiceBuilder(db: ReturnType<typeof drizzle>) {
  return {
    async upsertAttribute(attribute: WithMetadata<Attribute>): Promise<void> {
      const attributeSQL = splitAttributeIntoObjectsSQL(
        attribute.data,
        attribute.metadata.version
      );

      await db.transaction(async (tx) => {
        await tx
          .delete(attributeInReadmodelAttribute)
          .where(eq(attributeInReadmodelAttribute.id, attributeSQL.id));

        await tx.insert(attributeInReadmodelAttribute).values(attributeSQL);
      });
    },
    async getAttributeById(
      attributeId: AttributeId
    ): Promise<WithMetadata<Attribute> | undefined> {
      const queryResult = await db
        .select()
        .from(attributeInReadmodelAttribute)
        .where(eq(attributeInReadmodelAttribute.id, attributeId));

      if (queryResult.length === 0) {
        return undefined;
      }

      return aggregateAttribute(queryResult[0]);
    },
    async deleteAttributeById(attributeId: AttributeId): Promise<void> {
      await db
        .delete(attributeInReadmodelAttribute)
        .where(eq(attributeInReadmodelAttribute.id, attributeId));
    },
  };
}

export type ReadModelService = ReturnType<typeof readModelServiceBuilder>;
