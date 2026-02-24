import { eq } from "drizzle-orm";
import { setupTestContainersVitest } from "pagopa-interop-commons-test";
import { ProducerKeychain, ProducerKeychainId } from "pagopa-interop-models";
import { producerKeychainReadModelServiceBuilder } from "pagopa-interop-readmodel";
import {
  ProducerKeychainItemsSQL,
  DrizzleReturnType,
  ProducerKeychainSQL,
  producerKeychainInReadmodelProducerKeychain,
  ProducerKeychainUserSQL,
  producerKeychainUserInReadmodelProducerKeychain,
  ProducerKeychainEServiceSQL,
  producerKeychainEserviceInReadmodelProducerKeychain,
  ProducerKeychainKeySQL,
  producerKeychainKeyInReadmodelProducerKeychain,
} from "pagopa-interop-readmodel-models";
import { inject, afterEach, expect } from "vitest";
import { producerKeychainWriterServiceBuilder } from "../src/producerKeychainWriterService.js";

export const { cleanup, readModelDB } = await setupTestContainersVitest(
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  inject("readModelSQLConfig")
);

afterEach(cleanup);

export const producerKeychainReadModelService =
  producerKeychainReadModelServiceBuilder(readModelDB);
export const producerKeychainWriterService =
  producerKeychainWriterServiceBuilder(readModelDB);

export const checkCompleteProducerKeychain = async (
  producerKeychain: ProducerKeychain
): Promise<ProducerKeychainItemsSQL> => {
  const producerKeychainSQL = await retrieveProducerKeychainSQLById(
    producerKeychain.id,
    readModelDB
  );
  const producerKeychainUsersSQL = await retrieveProducerKeychainUsersSQLById(
    producerKeychain.id,
    readModelDB
  );
  const producerKeychainEServicesSQL =
    await retrieveProducerKeychainEServicesSQLById(
      producerKeychain.id,
      readModelDB
    );
  const producerKeychainKeysSQL = await retrieveProducerKeychainKeysSQLById(
    producerKeychain.id,
    readModelDB
  );

  expect(producerKeychainSQL).toBeDefined();
  expect(producerKeychainUsersSQL).toHaveLength(producerKeychain.users.length);
  expect(producerKeychainEServicesSQL).toHaveLength(
    producerKeychain.eservices.length
  );
  expect(producerKeychainKeysSQL).toHaveLength(producerKeychain.keys.length);

  return {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    producerKeychainSQL: producerKeychainSQL!,
    usersSQL: producerKeychainUsersSQL,
    eservicesSQL: producerKeychainEServicesSQL,
    keysSQL: producerKeychainKeysSQL,
  };
};

export const retrieveProducerKeychainSQLById = async (
  producerKeychainId: ProducerKeychainId,
  db: DrizzleReturnType
): Promise<ProducerKeychainSQL | undefined> => {
  const result = await db
    .select()
    .from(producerKeychainInReadmodelProducerKeychain)
    .where(
      eq(producerKeychainInReadmodelProducerKeychain.id, producerKeychainId)
    );

  return result[0];
};

export const retrieveProducerKeychainUsersSQLById = async (
  producerKeychainId: ProducerKeychainId,
  db: DrizzleReturnType
): Promise<ProducerKeychainUserSQL[]> =>
  await db
    .select()
    .from(producerKeychainUserInReadmodelProducerKeychain)
    .where(
      eq(
        producerKeychainUserInReadmodelProducerKeychain.producerKeychainId,
        producerKeychainId
      )
    );

export const retrieveProducerKeychainEServicesSQLById = async (
  producerKeychainId: ProducerKeychainId,
  db: DrizzleReturnType
): Promise<ProducerKeychainEServiceSQL[]> =>
  await db
    .select()
    .from(producerKeychainEserviceInReadmodelProducerKeychain)
    .where(
      eq(
        producerKeychainEserviceInReadmodelProducerKeychain.producerKeychainId,
        producerKeychainId
      )
    );

export const retrieveProducerKeychainKeysSQLById = async (
  producerKeychainId: ProducerKeychainId,
  db: DrizzleReturnType
): Promise<ProducerKeychainKeySQL[]> =>
  await db
    .select()
    .from(producerKeychainKeyInReadmodelProducerKeychain)
    .where(
      eq(
        producerKeychainKeyInReadmodelProducerKeychain.producerKeychainId,
        producerKeychainId
      )
    );
