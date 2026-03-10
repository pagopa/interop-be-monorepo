import { getMockClient } from "pagopa-interop-commons-test";
import { describe, expect, it } from "vitest";
import { genericLogger } from "pagopa-interop-commons";
import { Client, WithMetadata, clientKind } from "pagopa-interop-models";
import { upsertClient } from "pagopa-interop-readmodel/testUtils";
import { compare } from "../src/utils.js";
import {
  addOneClient,
  readModelDB,
  readModelServiceKPI,
  readModelServiceSQL,
} from "./utils.js";

describe("Check client readmodels", () => {
  it("should return -1 if the postgres schema is empty", async () => {
    const client = getMockClient();

    await addOneClient({
      data: client,
      metadata: { version: 1 },
    });

    const clients = await readModelServiceKPI.getAllClients();

    const postgresClients = await readModelServiceSQL.getAllClients();

    const res = compare({
      kpiItems: clients,
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

    await upsertClient(readModelDB, client.data, client.metadata.version);

    const clients = await readModelServiceKPI.getAllClients();

    const postgresClients = await readModelServiceSQL.getAllClients();

    const res = compare({
      kpiItems: clients,
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

    await upsertClient(readModelDB, client2.data, client2.metadata.version);

    const clients = await readModelServiceKPI.getAllClients();

    const postgresClients = await readModelServiceSQL.getAllClients();

    const res = compare({
      kpiItems: clients,
      postgresItems: postgresClients,
      schema: "client",
      loggerInstance: genericLogger,
    });

    expect(res).toEqual(1);
  });

  it("should detect differences if the kpi item is not present", async () => {
    const client1: WithMetadata<Client> = {
      data: getMockClient(),
      metadata: { version: 1 },
    };

    const client2: WithMetadata<Client> = {
      data: getMockClient(),
      metadata: { version: 1 },
    };

    await addOneClient(client1);

    await upsertClient(readModelDB, client1.data, client1.metadata.version);
    await upsertClient(readModelDB, client2.data, client2.metadata.version);

    const clients = await readModelServiceKPI.getAllClients();

    const postgresClients = await readModelServiceSQL.getAllClients();

    const res = compare({
      kpiItems: clients,
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

    const client1InPostgresDb: WithMetadata<Client> = {
      data: {
        ...client1.data,
        kind: clientKind.api,
      },
      metadata: client1.metadata,
    };

    await addOneClient(client1);

    await upsertClient(
      readModelDB,
      client1InPostgresDb.data,
      client1InPostgresDb.metadata.version
    );

    const clients = await readModelServiceKPI.getAllClients();

    const postgresClients = await readModelServiceSQL.getAllClients();

    const res = compare({
      kpiItems: clients,
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

    const client1InPostgresDb: WithMetadata<Client> = {
      data: client1.data,
      metadata: {
        version: 3,
      },
    };

    await addOneClient(client1);

    await upsertClient(
      readModelDB,
      client1InPostgresDb.data,
      client1InPostgresDb.metadata.version
    );

    const clients = await readModelServiceKPI.getAllClients();

    const postgresClients = await readModelServiceSQL.getAllClients();

    const res = compare({
      kpiItems: clients,
      postgresItems: postgresClients,
      schema: "client",
      loggerInstance: genericLogger,
    });

    expect(res).toEqual(1);
  });
});
