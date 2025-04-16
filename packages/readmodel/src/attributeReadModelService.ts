import { and, eq, lte, SQL } from "drizzle-orm";
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
import { splitAttributeIntoObjectsSQL } from "./attribute/splitters.js";
import {
  aggregateAttribute,
  aggregateAttributeArray,
} from "./attribute/aggregators.js";
import { checkMetadataVersion } from "./utils.js";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function attributeReadModelServiceBuilder(db: DrizzleReturnType) {
  return {
    async upsertAttribute(
      attribute: Attribute,
      metadataVersion: number
    ): Promise<void> {
      await db.transaction(async (tx) => {
        const shouldUpsert = await checkMetadataVersion(
          tx,
          attributeInReadmodelAttribute,
          metadataVersion,
          attribute.id
        );

        if (shouldUpsert) {
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
      return this.getAttributeByFilter(
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
