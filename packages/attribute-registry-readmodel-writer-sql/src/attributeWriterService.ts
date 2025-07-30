import { and, eq, lte } from "drizzle-orm";
import { Attribute, AttributeId } from "pagopa-interop-models";
import {
  checkMetadataVersion,
  splitAttributeIntoObjectsSQL,
} from "pagopa-interop-readmodel";
import {
  attributeInReadmodelAttribute,
  DrizzleReturnType,
} from "pagopa-interop-readmodel-models";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function attributeWriterServiceBuilder(db: DrizzleReturnType) {
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

        if (!shouldUpsert) {
          return;
        }

        await tx
          .delete(attributeInReadmodelAttribute)
          .where(eq(attributeInReadmodelAttribute.id, attribute.id));

        const attributeSQL = splitAttributeIntoObjectsSQL(
          attribute,
          metadataVersion
        );

        await tx.insert(attributeInReadmodelAttribute).values(attributeSQL);
      });
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
export type AttributeWriterService = ReturnType<
  typeof attributeWriterServiceBuilder
>;
