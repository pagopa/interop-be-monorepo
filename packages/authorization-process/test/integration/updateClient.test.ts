import { authorizationApi } from "pagopa-interop-api-clients";
import {
  decodeProtobufPayload,
  getMockAuthData,
  getMockClient,
  getMockContext,
  getMockContextM2MAdmin,
  getMockKey,
  ReadEvent,
  writeInEventstore,
} from "pagopa-interop-commons-test";
import {
  AuthorizationEvent,
  Client,
  ClientId,
  ClientDescriptionUpdatedV2,
  ClientNameUpdatedV2,
  clientKind,
  eventConflictError,
  generateId,
  hyperlinkDetectionError,
  TenantId,
  UserId,
  toClientV2,
} from "pagopa-interop-models";
import { upsertClient } from "pagopa-interop-readmodel/testUtils";
import { describe, expect, it } from "vitest";

import {
  clientKindNotAllowed,
  clientNotFound,
  tenantNotAllowedOnClient,
} from "../../src/model/domain/errors.js";
import {
  addOneClient,
  authorizationService,
  postgresDB,
  readModelDB,
} from "../integrationUtils.js";

const readEvents = async (
  client: Client
): Promise<Array<ReadEvent<AuthorizationEvent> & { correlation_id: string }>> =>
  postgresDB.manyOrNone(
    'SELECT * FROM "authorization".events WHERE stream_id = $1 ORDER BY version',
    [client.id]
  );

const callers = [
  { kind: clientKind.consumer, m2m: false },
  { kind: clientKind.api, m2m: false },
  { kind: clientKind.consumer, m2m: true },
];
const changes: authorizationApi.ClientUpdateSeed[] = [
  { name: "Updated name" },
  { description: "Updated description" },
  { name: "Updated name", description: "Updated description" },
];

describe("updateClient", () => {
  it.each(callers)(
    "should update $kind with m2m=$m2m atomically",
    async ({ kind, m2m }) => {
      const client = {
        ...getMockClient({
          kind,
          users: [generateId()],
          purposes: [generateId()],
          keys: [getMockKey()],
          adminId: generateId<UserId>(),
        }),
        name: "Original name",
        description: "Original description",
      };
      await addOneClient(client);
      const ctx = m2m
        ? getMockContextM2MAdmin({ organizationId: client.consumerId })
        : getMockContext({ authData: getMockAuthData(client.consumerId) });
      const seed = { name: "Updated name", description: "Updated description" };
      const updatedClient = { ...client, ...seed };

      const result = await authorizationService.updateClient(
        { clientId: client.id, seed },
        ctx
      );

      expect(result).toEqual({
        data: updatedClient,
        metadata: { version: 2 },
      });
      const events = await readEvents(client);
      expect(events).toHaveLength(3);
      expect(events[1]).toMatchObject({
        type: "ClientNameUpdated",
        event_version: 2,
        version: "1",
        correlation_id: ctx.correlationId,
      });
      expect(events[2]).toMatchObject({
        type: "ClientDescriptionUpdated",
        event_version: 2,
        version: "2",
        correlation_id: ctx.correlationId,
      });
      expect(
        decodeProtobufPayload({
          messageType: ClientNameUpdatedV2,
          payload: events[1].data,
        })
      ).toEqual({
        client: toClientV2({ ...client, name: seed.name }),
      });
      expect(
        decodeProtobufPayload({
          messageType: ClientDescriptionUpdatedV2,
          payload: events[2].data,
        })
      ).toEqual({ client: toClientV2(updatedClient) });
    }
  );

  it.each(changes)("should preserve omitted fields for %s", async (seed) => {
    const client = {
      ...getMockClient(),
      name: "Original name",
      description: "Original description",
    };
    await addOneClient(client);
    const result = await authorizationService.updateClient(
      { clientId: client.id, seed },
      getMockContext({ authData: getMockAuthData(client.consumerId) })
    );
    const count = Object.keys(seed).length;
    expect(result).toEqual({
      data: { ...client, ...seed },
      metadata: { version: count },
    });
    expect(await readEvents(client)).toHaveLength(count + 1);
  });

  it.each(changes)(
    "should write events for supplied unchanged values: %s",
    async (seed) => {
      const client = {
        ...getMockClient(),
        name: "Updated name",
        description: "Updated description",
      };
      await addOneClient(client);
      const result = await authorizationService.updateClient(
        { clientId: client.id, seed },
        getMockContext({ authData: getMockAuthData(client.consumerId) })
      );
      const count = Object.keys(seed).length;
      expect(result).toEqual({ data: client, metadata: { version: count } });
      const events = await readEvents(client);
      expect(events).toHaveLength(count + 1);
      expect(events.slice(1).map((event) => event.type)).toEqual([
        ...(seed.name !== undefined ? ["ClientNameUpdated"] : []),
        ...(seed.description !== undefined ? ["ClientDescriptionUpdated"] : []),
      ]);
    }
  );

  it.each([
    { name: "Updated name", description: "Original description" },
    { name: "Original name", description: "Updated description" },
  ])(
    "should emit events for changed and unchanged supplied fields: %s",
    async (seed) => {
      const client = {
        ...getMockClient(),
        name: "Original name",
        description: "Original description",
      };
      await addOneClient(client);
      const result = await authorizationService.updateClient(
        { clientId: client.id, seed },
        getMockContext({ authData: getMockAuthData(client.consumerId) })
      );
      expect(result).toEqual({
        data: { ...client, ...seed },
        metadata: { version: 2 },
      });
      const events = await readEvents(client);
      expect(events).toHaveLength(3);
      expect(events.slice(1).map((event) => event.type)).toEqual([
        "ClientNameUpdated",
        "ClientDescriptionUpdated",
      ]);
    }
  );

  it("should advance the current nonzero version for a repeated M2M update", async () => {
    const client = { ...getMockClient(), name: "Original name" };
    await addOneClient(client);
    const ctx = getMockContextM2MAdmin({
      organizationId: client.consumerId,
    });
    const seed = { name: "Updated name" };
    const updatedClient = await authorizationService.updateClient(
      { clientId: client.id, seed },
      ctx
    );
    await upsertClient(
      readModelDB,
      updatedClient.data,
      updatedClient.metadata.version
    );

    const result = await authorizationService.updateClient(
      { clientId: client.id, seed },
      ctx
    );
    expect(result).toEqual({
      data: updatedClient.data,
      metadata: { version: 2 },
    });
    const events = await readEvents(client);
    expect(events).toHaveLength(3);
    expect(events.slice(1)).toMatchObject([
      {
        type: "ClientNameUpdated",
        version: "1",
        correlation_id: ctx.correlationId,
      },
      {
        type: "ClientNameUpdated",
        version: "2",
        correlation_id: ctx.correlationId,
      },
    ]);
  });

  it("should preserve an absent description for a name-only patch", async () => {
    const client = { ...getMockClient(), description: undefined };
    await addOneClient(client);
    const result = await authorizationService.updateClient(
      { clientId: client.id, seed: { name: "Updated name" } },
      getMockContext({ authData: getMockAuthData(client.consumerId) })
    );
    expect(result.data).toEqual({ ...client, name: "Updated name" });
    expect(result.metadata.version).toBe(1);
  });

  it("should not require unique client names", async () => {
    const client = { ...getMockClient(), name: "Original name" };
    const otherClient = {
      ...getMockClient({ consumerId: client.consumerId }),
      name: "Existing name",
    };
    await addOneClient(client);
    await addOneClient(otherClient);
    const result = await authorizationService.updateClient(
      { clientId: client.id, seed: { name: otherClient.name } },
      getMockContext({ authData: getMockAuthData(client.consumerId) })
    );
    expect(result.data.name).toBe(otherClient.name);
  });

  it.each([false, true])(
    "should reject a non-owner with m2m=%s",
    async (m2m) => {
      const client = getMockClient();
      await addOneClient(client);
      const organizationId = generateId<TenantId>();
      const ctx = m2m
        ? getMockContextM2MAdmin({ organizationId })
        : getMockContext({ authData: getMockAuthData(organizationId) });
      await expect(
        authorizationService.updateClient(
          { clientId: client.id, seed: { name: client.name } },
          ctx
        )
      ).rejects.toThrowError(
        tenantNotAllowedOnClient(organizationId, client.id)
      );
      expect(await readEvents(client)).toHaveLength(1);
    }
  );

  it("should reject an API client via M2M even for unchanged values", async () => {
    const client = getMockClient({ kind: clientKind.api });
    await addOneClient(client);
    await expect(
      authorizationService.updateClient(
        { clientId: client.id, seed: { name: client.name } },
        getMockContextM2MAdmin({ organizationId: client.consumerId })
      )
    ).rejects.toThrowError(clientKindNotAllowed(client.id));
    expect(await readEvents(client)).toHaveLength(1);
  });

  it("should reject a missing client", async () => {
    const clientId = generateId<ClientId>();
    await expect(
      authorizationService.updateClient(
        { clientId, seed: { name: "Updated name" } },
        getMockContext({})
      )
    ).rejects.toThrowError(clientNotFound(clientId));
  });

  it.each([
    { name: "https://example.com", description: "Updated description" },
    { name: "Updated name", description: "https://example.com" },
  ])(
    "should reject hyperlinks without persisting either change: %s",
    async (seed) => {
      const client = getMockClient();
      await addOneClient(client);
      await expect(
        authorizationService.updateClient(
          { clientId: client.id, seed },
          getMockContext({ authData: getMockAuthData(client.consumerId) })
        )
      ).rejects.toThrowError(hyperlinkDetectionError("https://example.com"));
      expect(await readEvents(client)).toHaveLength(1);
    }
  );

  it("should reject a stale write without retrying", async () => {
    const client = { ...getMockClient(), name: "Original name" };
    await addOneClient(client);
    const ctx = getMockContext({
      authData: getMockAuthData(client.consumerId),
    });
    await authorizationService.updateClient(
      { clientId: client.id, seed: { name: "First update" } },
      ctx
    );
    await expect(
      authorizationService.updateClient(
        { clientId: client.id, seed: { name: "Second update" } },
        ctx
      )
    ).rejects.toThrowError(eventConflictError(ctx.correlationId, client.id, 0));
    expect(await readEvents(client)).toHaveLength(2);
  });

  it("should roll back the first event when the second event conflicts", async () => {
    const client = {
      ...getMockClient(),
      name: "Original name",
      description: "Original description",
    };
    await addOneClient(client);
    await writeInEventstore(
      {
        stream_id: client.id,
        version: 2,
        event: {
          type: "ClientNameUpdated",
          event_version: 2,
          data: { client: toClientV2(client) },
        },
      },
      '"authorization"',
      postgresDB
    );
    const ctx = getMockContext({
      authData: getMockAuthData(client.consumerId),
    });
    await expect(
      authorizationService.updateClient(
        {
          clientId: client.id,
          seed: { name: "Updated name", description: "Updated description" },
        },
        ctx
      )
    ).rejects.toThrowError(eventConflictError(ctx.correlationId, client.id, 1));
    const events = await readEvents(client);
    expect(events.map((event) => event.version)).toEqual(["0", "2"]);
  });
});
