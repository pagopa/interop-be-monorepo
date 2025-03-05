import { getMockClient } from "pagopa-interop-commons-test";
import { describe, expect, it } from "vitest";
import { genericLogger } from "pagopa-interop-commons";
import { Client, WithMetadata, clientKind } from "pagopa-interop-models";
import { compare } from "../src/utils.js";
import {
  addOneClient,
  clientReadModelServiceSQL,
  readModelService,
} from "./utils.js";

describe("Check client readmodels", () => {
  it("should return -1 if the postgres schema is empty", async () => {
    const client = getMockClient();

    await addOneClient({
      data: client,
      metadata: { version: 1 },
    });

    const collectionClients = await readModelService.getAllReadModelClients();

    const postgresClients = await clientReadModelServiceSQL.getAllClients();

    const res = compare({
      collectionItems: collectionClients,
      postgresItems: postgresClients,
      schema: "client",
      loggerInstance: genericLogger,
    });

    expect(res).toEqual(-1);
  });

  it("should detect no differences if all the items are equal", async () => {
    const client: WithMetadata<Client> = {
      data: getMockClient(),
      metadata: { version: 1 },
    };

    await addOneClient(client);

    await clientReadModelServiceSQL.upsertClient(client);

    const collectionClients = await readModelService.getAllReadModelClients();

    const postgresClients = await clientReadModelServiceSQL.getAllClients();

    const res = compare({
      collectionItems: collectionClients,
      postgresItems: postgresClients,
      schema: "client",
      loggerInstance: genericLogger,
    });

    expect(res).toEqual(0);
  });

  it("should detect differences if the postgres item is not present", async () => {
    const client1: WithMetadata<Client> = {
      data: getMockClient(),
      metadata: { version: 1 },
    };

    const client2: WithMetadata<Client> = {
      data: getMockClient(),
      metadata: { version: 1 },
    };

    await addOneClient(client1);
    await addOneClient(client2);

    await clientReadModelServiceSQL.upsertClient(client2);

    const collectionClients = await readModelService.getAllReadModelClients();

    const postgresClients = await clientReadModelServiceSQL.getAllClients();

    const res = compare({
      collectionItems: collectionClients,
      postgresItems: postgresClients,
      schema: "client",
      loggerInstance: genericLogger,
    });

    expect(res).toEqual(1);
  });

  it("should detect differences if the collection item is not present", async () => {
    const client1: WithMetadata<Client> = {
      data: getMockClient(),
      metadata: { version: 1 },
    };

    const client2: WithMetadata<Client> = {
      data: getMockClient(),
      metadata: { version: 1 },
    };

    await addOneClient(client1);

    await clientReadModelServiceSQL.upsertClient(client1);
    await clientReadModelServiceSQL.upsertClient(client2);

    const collectionClients = await readModelService.getAllReadModelClients();

    const postgresClients = await clientReadModelServiceSQL.getAllClients();

    const res = compare({
      collectionItems: collectionClients,
      postgresItems: postgresClients,
      schema: "client",
      loggerInstance: genericLogger,
    });

    expect(res).toEqual(1);
  });

  it("should detect differences if the items are different", async () => {
    const client1: WithMetadata<Client> = {
      data: {
        ...getMockClient(),
        kind: clientKind.consumer,
      },
      metadata: { version: 1 },
    };

    const client1ForSQL: WithMetadata<Client> = {
      data: {
        ...client1.data,
        kind: clientKind.api,
      },
      metadata: client1.metadata,
    };

    await addOneClient(client1);

    await clientReadModelServiceSQL.upsertClient(client1ForSQL);

    const collectionClients = await readModelService.getAllReadModelClients();

    const postgresClients = await clientReadModelServiceSQL.getAllClients();

    const res = compare({
      collectionItems: collectionClients,
      postgresItems: postgresClients,
      schema: "client",
      loggerInstance: genericLogger,
    });

    expect(res).toEqual(1);
  });

  it("should detect differences if the items are equal but the version is different", async () => {
    const client1: WithMetadata<Client> = {
      data: getMockClient(),
      metadata: { version: 1 },
    };

    const client1ForSQL: WithMetadata<Client> = {
      data: client1.data,
      metadata: {
        version: 3,
      },
    };

    await addOneClient(client1);

    await clientReadModelServiceSQL.upsertClient(client1ForSQL);

    const collectionClients = await readModelService.getAllReadModelClients();

    const postgresClients = await clientReadModelServiceSQL.getAllClients();

    const res = compare({
      collectionItems: collectionClients,
      postgresItems: postgresClients,
      schema: "client",
      loggerInstance: genericLogger,
    });

    expect(res).toEqual(1);
  });
});
