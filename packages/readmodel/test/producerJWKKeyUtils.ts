import { ProducerKeychainId } from "pagopa-interop-models";
import {
  DrizzleReturnType,
  producerJwkKeyInReadmodelProducerJwkKey,
  ProducerJWKKeySQL,
} from "pagopa-interop-readmodel-models";
import { and, eq } from "drizzle-orm";
import { producerJWKKeyReadModelServiceBuilder } from "../src/producerJWKKeyReadModelService.js";
import { readModelDB } from "./utils.js";

export const producerJWKKeyReadModelService =
  producerJWKKeyReadModelServiceBuilder(readModelDB);

export const retrieveProducerJWKKeySQLByKid = async (
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
