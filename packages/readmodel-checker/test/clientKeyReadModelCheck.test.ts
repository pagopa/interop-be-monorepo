import { getMockKey } from "pagopa-interop-commons-test";
import { describe, expect, it } from "vitest";
import { genericLogger, keyToClientJWKKey } from "pagopa-interop-commons";
import {
  ClientId,
  ClientJWKKey,
  WithMetadata,
  generateId,
} from "pagopa-interop-models";
import { compare } from "../src/utils.js";
import {
  addOneClientJWKKey,
  clientKeysReadModelServiceSQL,
  readModelService,
} from "./utils.js";

describe("Check client key readmodels", () => {
  it("should return -1 if the postgres schema is empty", async () => {
    const jwkKey = keyToClientJWKKey(getMockKey(), generateId<ClientId>());

    await addOneClientJWKKey({
      data: jwkKey,
      metadata: { version: 1 },
    });

    const collectionKeys = await readModelService.getAllReadModelClientJWKKey();

    const postgresKeys =
      await clientKeysReadModelServiceSQL.getAllClientJWKKeys();

    const res = compare({
      collectionItems: collectionKeys,
      postgresItems: postgresKeys,
      schema: "client keys",
      loggerInstance: genericLogger,
    });

    expect(res).toEqual(-1);
  });

  it("should detect no differences if all the items are equal", async () => {
    const jwkKey = keyToClientJWKKey(getMockKey(), generateId<ClientId>());

    await addOneClientJWKKey({
      data: jwkKey,
      metadata: { version: 1 },
    });

    await clientKeysReadModelServiceSQL.upsertClientJWKKey({
      data: jwkKey,
      metadata: { version: 1 },
    });

    const collectionKeys = await readModelService.getAllReadModelClientJWKKey();

    const postgresKeys =
      await clientKeysReadModelServiceSQL.getAllClientJWKKeys();

    const res = compare({
      collectionItems: collectionKeys,
      postgresItems: postgresKeys,
      schema: "client keys",
      loggerInstance: genericLogger,
    });

    expect(res).toEqual(0);
  });

  it("should detect differences if the postgres item is not present", async () => {
    const jwkKey = keyToClientJWKKey(getMockKey(), generateId<ClientId>());

    const jwkKey2 = keyToClientJWKKey(getMockKey(), generateId<ClientId>());

    await addOneClientJWKKey({
      data: jwkKey,
      metadata: { version: 1 },
    });

    await addOneClientJWKKey({
      data: jwkKey2,
      metadata: { version: 1 },
    });

    await clientKeysReadModelServiceSQL.upsertClientJWKKey({
      data: jwkKey2,
      metadata: { version: 1 },
    });

    const collectionKeys = await readModelService.getAllReadModelClientJWKKey();

    const postgresKeys =
      await clientKeysReadModelServiceSQL.getAllClientJWKKeys();

    const res = compare({
      collectionItems: collectionKeys,
      postgresItems: postgresKeys,
      schema: "client keys",
      loggerInstance: genericLogger,
    });

    expect(res).toEqual(1);
  });

  it("should detect differences if the collection item is not present", async () => {
    const jwkKey1 = keyToClientJWKKey(getMockKey(), generateId<ClientId>());

    const jwkKey2 = keyToClientJWKKey(getMockKey(), generateId<ClientId>());

    await addOneClientJWKKey({
      data: jwkKey2,
      metadata: { version: 1 },
    });

    await addOneClientJWKKey({
      data: jwkKey1,
      metadata: { version: 1 },
    });

    await clientKeysReadModelServiceSQL.upsertClientJWKKey({
      data: jwkKey1,
      metadata: { version: 1 },
    });
    await clientKeysReadModelServiceSQL.upsertClientJWKKey({
      data: jwkKey2,
      metadata: { version: 1 },
    });

    const collectionKeys = await readModelService.getAllReadModelClientJWKKey();

    const postgresKeys =
      await clientKeysReadModelServiceSQL.getAllClientJWKKeys();

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
      data: keyToClientJWKKey(getMockKey(), generateId<ClientId>()),
      metadata: { version: 1 },
    };

    const clientKey1ForSQL: WithMetadata<ClientJWKKey> = {
      data: keyToClientJWKKey(getMockKey(), generateId<ClientId>()),
      metadata: clientKey1.metadata,
    };

    await addOneClientJWKKey(clientKey1);

    await clientKeysReadModelServiceSQL.upsertClientJWKKey(clientKey1ForSQL);

    const collectionKeys = await readModelService.getAllReadModelClientJWKKey();

    const postgresKeys =
      await clientKeysReadModelServiceSQL.getAllClientJWKKeys();

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
      data: keyToClientJWKKey(getMockKey(), generateId<ClientId>()),
      metadata: { version: 1 },
    };

    const clientKey1ForSQL: WithMetadata<ClientJWKKey> = {
      data: clientKey1.data,
      metadata: { version: 3 },
    };

    await addOneClientJWKKey(clientKey1);

    await clientKeysReadModelServiceSQL.upsertClientJWKKey(clientKey1ForSQL);

    const collectionKeys = await readModelService.getAllReadModelClientJWKKey();

    const postgresKeys =
      await clientKeysReadModelServiceSQL.getAllClientJWKKeys();

    const res = compare({
      collectionItems: collectionKeys,
      postgresItems: postgresKeys,
      schema: "client keys",
      loggerInstance: genericLogger,
    });

    expect(res).toEqual(1);
  });
});
