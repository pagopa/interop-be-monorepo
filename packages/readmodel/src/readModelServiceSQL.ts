import { and, eq, lte } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Attribute, AttributeId, WithMetadata } from "pagopa-interop-models";
import { attributeInReadmodelAttribute } from "pagopa-interop-readmodel-models";
import { Pool } from "pg";
import { ReadModelSQLDbConfig } from "pagopa-interop-commons";
import { splitAttributeIntoObjectsSQL } from "./attribute/splitters.js";
import { aggregateAttribute } from "./attribute/aggregators.js";

export const makeDrizzleConnection = (
  readModelSQLDbConfig: ReadModelSQLDbConfig
): ReturnType<typeof drizzle> => {
  const pool = new Pool({
    host: readModelSQLDbConfig.readModelSQLDbHost,
    port: readModelSQLDbConfig.readModelSQLDbPort,
    database: readModelSQLDbConfig.readModelSQLDbName,
    user: readModelSQLDbConfig.readModelSQLDbUsername,
    password: readModelSQLDbConfig.readModelSQLDbPassword,
    ssl: readModelSQLDbConfig.readModelSQLDbUseSSL,
  });
  return drizzle({ client: pool });
};

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function readModelServiceBuilderSQL(db: ReturnType<typeof drizzle>) {
  return {
    // TODO: (attribute, version)?
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
    ): Promise<WithMetadata<Attribute>> {
      const queryResult = await db
        .select()
        .from(attributeInReadmodelAttribute)
        .where(eq(attributeInReadmodelAttribute.id, attributeId));

      return aggregateAttribute(queryResult[0]);
    },
    async deleteAttributeById(
      attributeId: AttributeId,
      version: number
    ): Promise<void> {
      await db
        .delete(attributeInReadmodelAttribute)
        .where(
          and(
            eq(attributeInReadmodelAttribute.id, attributeId),
            lte(attributeInReadmodelAttribute.metadataVersion, version)
          )
        );
    },
  };
}

export type ReadModelServiceSQL = ReturnType<typeof readModelServiceBuilderSQL>;
