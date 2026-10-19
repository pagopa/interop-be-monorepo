import { eq } from "drizzle-orm";
import { setupTestContainersVitest } from "pagopa-interop-commons-test";
import { AttributeId } from "pagopa-interop-models";
import { attributeReadModelServiceBuilder } from "pagopa-interop-readmodel";
import {
  DrizzleReturnType,
  AttributeSQL,
  attributeInReadmodelAttribute,
} from "pagopa-interop-readmodel-models";
import { inject, afterEach } from "vitest";

import { attributeWriterServiceBuilder } from "../src/attributeWriterService.js";

export const { cleanup, readModelDB } = await setupTestContainersVitest(
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  inject("readModelSQLConfig")
);

afterEach(cleanup);

export const attributeReadModelService =
  attributeReadModelServiceBuilder(readModelDB);

export const attributeWriterService =
  attributeWriterServiceBuilder(readModelDB);

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
