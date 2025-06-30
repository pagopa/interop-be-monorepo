import { eq } from "drizzle-orm";
import { AttributeId } from "pagopa-interop-models";
import {
  attributeInReadmodelAttribute,
  AttributeSQL,
  DrizzleReturnType,
} from "pagopa-interop-readmodel-models";
import { attributeReadModelServiceBuilder } from "../src/attributeReadModelService.js";
import { readModelDB } from "./utils.js";

export const attributeReadModelService =
  attributeReadModelServiceBuilder(readModelDB);

export const retrieveAttributeSQLById = async (
  attributeId: AttributeId,
  db: DrizzleReturnType
): Promise<AttributeSQL | undefined> => {
  const result = await db
    .select()
    .from(attributeInReadmodelAttribute)
    .where(eq(attributeInReadmodelAttribute.id, attributeId));

  return result[0];
};
