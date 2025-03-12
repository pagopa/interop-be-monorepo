import { and, eq, lte } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Attribute, AttributeId, WithMetadata } from "pagopa-interop-models";
import { attributeInReadmodelAttribute } from "pagopa-interop-readmodel-models";
import { splitAttributeIntoObjectsSQL } from "./attribute/splitters.js";
import {
  aggregateAttribute,
  aggregateAttributeArray,
} from "./attribute/aggregators.js";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function attributeReadModelServiceBuilder(
  db: ReturnType<typeof drizzle>
) {
  return {
    async upsertAttribute(
      attribute: Attribute,
      metadataVersion: number
    ): Promise<void> {
      const attributeSQL = splitAttributeIntoObjectsSQL(
        attribute,
        metadataVersion
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
    async deleteAttributeById(
      attributeId: AttributeId,
      metadataVersion: number
    ): Promise<void> {
      await db
        .delete(attributeInReadmodelAttribute)
        .where(
          and(
            eq(attributeInReadmodelAttribute.id, attributeId),
            lte(attributeInReadmodelAttribute.metadataVersion, metadataVersion)
          )
        );
    },
    async getAllAttributes(): Promise<Array<WithMetadata<Attribute>>> {
      const res = await db.select().from(attributeInReadmodelAttribute);

      return aggregateAttributeArray(res);
    },
  };
}

export type AttributeReadModelService = ReturnType<
  typeof attributeReadModelServiceBuilder
>;
