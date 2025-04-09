import {
  DrizzleReturnType,
  producerKeychainEserviceInReadmodelProducerKeychain,
  ProducerKeychainEServiceSQL,
  producerKeychainInReadmodelProducerKeychain,
  ProducerKeychainItemsSQL,
  producerKeychainKeyInReadmodelProducerKeychain,
  ProducerKeychainKeySQL,
  ProducerKeychainSQL,
  producerKeychainUserInReadmodelProducerKeychain,
  ProducerKeychainUserSQL,
} from "pagopa-interop-readmodel-models";
import { eq } from "drizzle-orm";
import { ProducerKeychain, ProducerKeychainId } from "pagopa-interop-models";
import { expect } from "vitest";
import { producerKeychainReadModelServiceBuilder } from "../src/producerKeychainReadModelService.js";
import { readModelDB } from "./utils.js";

export const producerKeychainReadModelService =
  producerKeychainReadModelServiceBuilder(readModelDB);

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
