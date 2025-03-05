import { drizzle } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";
import { AttributeId } from "pagopa-interop-models";
import {
  attributeInReadmodelAttribute,
  AttributeSQL,
} from "pagopa-interop-readmodel-models";

export const retrieveAttributeSQL = async (
  attributeId: AttributeId,
  db: ReturnType<typeof drizzle>
): Promise<AttributeSQL | undefined> => {
  const result = await db
    .select()
    .from(attributeInReadmodelAttribute)
    .where(eq(attributeInReadmodelAttribute.id, attributeId));

  return result[0];
};
