import { and, eq, lte } from "drizzle-orm";
import { Attribute, AttributeId, WithMetadata } from "pagopa-interop-models";
import {
  attributeInReadmodelAttribute,
  DrizzleReturnType,
} from "pagopa-interop-readmodel-models";
import { splitAttributeIntoObjectsSQL } from "./attribute/splitters.js";
import { aggregateAttribute } from "./attribute/aggregators.js";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function attributeReadModelServiceBuilder(db: DrizzleReturnType) {
  return {
    async upsertAttribute(
      attribute: Attribute,
      metadataVersion: number
    ): Promise<void> {
      await db.transaction(async (tx) => {
        const existingMetadataVersion: number | undefined = (
          await tx
            .select({
              metadataVersion: attributeInReadmodelAttribute.metadataVersion,
            })
            .from(attributeInReadmodelAttribute)
            .where(eq(attributeInReadmodelAttribute.id, attribute.id))
        )[0]?.metadataVersion;

        if (
          !existingMetadataVersion ||
          existingMetadataVersion <= metadataVersion
        ) {
          await tx
            .delete(attributeInReadmodelAttribute)
            .where(eq(attributeInReadmodelAttribute.id, attribute.id));

          const attributeSQL = splitAttributeIntoObjectsSQL(
            attribute,
            metadataVersion
          );

          await tx.insert(attributeInReadmodelAttribute).values(attributeSQL);
        }
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
  };
}

export type AttributeReadModelService = ReturnType<
  typeof attributeReadModelServiceBuilder
>;
