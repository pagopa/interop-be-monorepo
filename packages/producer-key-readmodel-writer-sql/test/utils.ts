import { setupTestContainersVitest } from "pagopa-interop-commons-test";
import { producerJWKKeyReadModelServiceBuilder } from "pagopa-interop-readmodel";
import { inject, afterEach } from "vitest";
import { and, eq } from "drizzle-orm";
import { ProducerKeychainId } from "pagopa-interop-models";
import {
  DrizzleReturnType,
  ProducerJWKKeySQL,
  producerJwkKeyInReadmodelProducerJwkKey,
} from "pagopa-interop-readmodel-models";
import { producerJWKKeyWriterServiceBuilder } from "../src/producerJWKKeyWriterService.js";

export const { cleanup, readModelDB } = await setupTestContainersVitest(
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  inject("readModelSQLConfig")
);

afterEach(cleanup);

export const producerJWKKeyReadModelService =
  producerJWKKeyReadModelServiceBuilder(readModelDB);
export const producerJWKKeyWriterService =
  producerJWKKeyWriterServiceBuilder(readModelDB);

export const retrieveProducerJWKKeySQLByProducerKeychainIdAndKid = async (
  producerKeychainId: ProducerKeychainId,
  kid: string,
  db: DrizzleReturnType
): Promise<ProducerJWKKeySQL | undefined> => {
  const result = await db
    .select()
    .from(producerJwkKeyInReadmodelProducerJwkKey)
    .where(
      and(
        eq(
          producerJwkKeyInReadmodelProducerJwkKey.producerKeychainId,
          producerKeychainId
        ),
        eq(producerJwkKeyInReadmodelProducerJwkKey.kid, kid)
      )
    );

  return result[0];
};
