import { getMockClientJWKKey } from "pagopa-interop-commons-test";
import { describe, expect, it } from "vitest";
import { genericLogger } from "pagopa-interop-commons";
import { ClientJWKKey, WithMetadata } from "pagopa-interop-models";
import { upsertClientJWKKey } from "pagopa-interop-readmodel/testUtils";
import { compare } from "../src/utils.js";
import {
  addOneClientJWKKey,
  readModelDB,
  readModelService,
  readModelServiceSQL,
} from "./utils.js";

describe("Check client key readmodels", () => {
  it("should return -1 if the postgres schema is empty", async () => {
    const jwkKey = getMockClientJWKKey();

    await addOneClientJWKKey({
      data: jwkKey,
      metadata: { version: 1 },
    });

    const collectionKeys = await readModelService.getAllReadModelClientJWKKey();

    const postgresKeys = await readModelServiceSQL.getAllClientJWKKeys();

    const res = compare({
      collectionItems: collectionKeys,
      postgresItems: postgresKeys,
      schema: "client keys",
      loggerInstance: genericLogger,
    });

    expect(res).toEqual(-1);
  });

  it("should detect no differences if all the items are equal", async () => {
    const jwkKey = getMockClientJWKKey();

    await addOneClientJWKKey({
      data: jwkKey,
      metadata: { version: 1 },
    });

    await upsertClientJWKKey(readModelDB, jwkKey, 1);

    const collectionKeys = await readModelService.getAllReadModelClientJWKKey();

    const postgresKeys = await readModelServiceSQL.getAllClientJWKKeys();

    const res = compare({
      collectionItems: collectionKeys,
      postgresItems: postgresKeys,
      schema: "client keys",
      loggerInstance: genericLogger,
    });

    expect(res).toEqual(0);
  });

  it("should detect differences if the postgres item is not present", async () => {
    const jwkKey = getMockClientJWKKey();

    const jwkKey2 = getMockClientJWKKey();

    await addOneClientJWKKey({
      data: jwkKey,
      metadata: { version: 1 },
    });

    await addOneClientJWKKey({
      data: jwkKey2,
      metadata: { version: 1 },
    });

    await upsertClientJWKKey(readModelDB, jwkKey2, 1);

    const collectionKeys = await readModelService.getAllReadModelClientJWKKey();

    const postgresKeys = await readModelServiceSQL.getAllClientJWKKeys();

    const res = compare({
      collectionItems: collectionKeys,
      postgresItems: postgresKeys,
      schema: "client keys",
      loggerInstance: genericLogger,
    });

    expect(res).toEqual(1);
  });

  it("should detect differences if the collection item is not present", async () => {
    const jwkKey1 = getMockClientJWKKey();
    const jwkKey2 = getMockClientJWKKey();

    await addOneClientJWKKey({
      data: jwkKey1,
      metadata: { version: 1 },
    });

    await upsertClientJWKKey(readModelDB, jwkKey1, 1);
    await upsertClientJWKKey(readModelDB, jwkKey2, 1);

    const collectionKeys = await readModelService.getAllReadModelClientJWKKey();

    const postgresKeys = await readModelServiceSQL.getAllClientJWKKeys();

    const res = compare({
      collectionItems: collectionKeys,
      postgresItems: postgresKeys,
      schema: "client keys",
      loggerInstance: genericLogger,
    });

    expect(res).toEqual(1);
  });

  it("should detect differences if the items are different", async () => {
    const clientKey1: WithMetadata<ClientJWKKey> = {
      data: getMockClientJWKKey(),
      metadata: { version: 1 },
    };
    const clientKey1InPostgresDb: WithMetadata<ClientJWKKey> = {
      data: { ...clientKey1.data, alg: "wrong-alg" },
      metadata: clientKey1.metadata,
    };

    await addOneClientJWKKey(clientKey1);

    await upsertClientJWKKey(
      readModelDB,
      clientKey1InPostgresDb.data,
      clientKey1InPostgresDb.metadata.version
    );

    const collectionKeys = await readModelService.getAllReadModelClientJWKKey();

    const postgresKeys = await readModelServiceSQL.getAllClientJWKKeys();

    const res = compare({
      collectionItems: collectionKeys,
      postgresItems: postgresKeys,
      schema: "client keys",
      loggerInstance: genericLogger,
    });

    expect(res).toEqual(1);
  });

  it("should detect differences if the items are equal but the version is different", async () => {
    const clientKey1: WithMetadata<ClientJWKKey> = {
      data: getMockClientJWKKey(),
      metadata: { version: 1 },
    };
    const clientKey1InPostgresDb: WithMetadata<ClientJWKKey> = {
      data: clientKey1.data,
      metadata: { version: 3 },
    };

    await addOneClientJWKKey(clientKey1);

    await upsertClientJWKKey(
      readModelDB,
      clientKey1InPostgresDb.data,
      clientKey1InPostgresDb.metadata.version
    );

    const collectionKeys = await readModelService.getAllReadModelClientJWKKey();

    const postgresKeys = await readModelServiceSQL.getAllClientJWKKeys();

    const res = compare({
      collectionItems: collectionKeys,
      postgresItems: postgresKeys,
      schema: "client keys",
      loggerInstance: genericLogger,
    });

    expect(res).toEqual(1);
  });
});
