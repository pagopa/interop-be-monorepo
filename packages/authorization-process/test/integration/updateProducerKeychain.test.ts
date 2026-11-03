import { authorizationApi } from "pagopa-interop-api-clients";
import {
  decodeProtobufPayload,
  getMockAuthData,
  getMockProducerKeychain,
  getMockContext,
  getMockContextM2MAdmin,
  getMockKey,
  ReadEvent,
  writeInEventstore,
} from "pagopa-interop-commons-test";
import {
  AuthorizationEvent,
  ProducerKeychain,
  ProducerKeychainId,
  ProducerKeychainDescriptionUpdatedV2,
  ProducerKeychainNameUpdatedV2,
  eventConflictError,
  generateId,
  hyperlinkDetectionError,
  TenantId,
  toProducerKeychainV2,
} from "pagopa-interop-models";
import { upsertProducerKeychain } from "pagopa-interop-readmodel/testUtils";
import { describe, expect, it, vi } from "vitest";

import {
  producerKeychainNotFound,
  tenantNotAllowedOnProducerKeychain,
} from "../../src/model/domain/errors.js";
import {
  addOneProducerKeychain,
  authorizationService,
  postgresDB,
  readModelDB,
} from "../integrationUtils.js";

const readEvents = async (
  producerKeychain: ProducerKeychain
): Promise<Array<ReadEvent<AuthorizationEvent> & { correlation_id: string }>> =>
  postgresDB.manyOrNone(
    'SELECT * FROM "authorization".events WHERE stream_id = $1 ORDER BY version',
    [producerKeychain.id]
  );

const changes: authorizationApi.ProducerKeychainUpdateSeed[] = [
  { name: "Updated name" },
  { description: "Updated description" },
  { name: "Updated name", description: "Updated description" },
];

describe("updateProducerKeychain", () => {
  it.each([false, true])(
    "should update atomically with m2m=%s and preserve users, keys and eservices",
    async (m2m) => {
      const producerKeychain: ProducerKeychain = {
        ...getMockProducerKeychain(),
        name: "Original name",
        description: "Original description",
        users: [generateId()],
        keys: [getMockKey()],
        eservices: [generateId()],
      };
      await addOneProducerKeychain(producerKeychain);
      const ctx = m2m
        ? getMockContextM2MAdmin({
            organizationId: producerKeychain.producerId,
          })
        : getMockContext({
            authData: getMockAuthData(producerKeychain.producerId),
          });
      const seed = { name: "Updated name", description: "Updated description" };
      const updatedProducerKeychain = { ...producerKeychain, ...seed };
      const transactionSpy = vi.spyOn(postgresDB, "tx");
      transactionSpy.mockClear();
      const result = await authorizationService.updateProducerKeychain(
        { producerKeychainId: producerKeychain.id, seed },
        ctx
      );
      expect(transactionSpy).toHaveBeenCalledTimes(1);
      transactionSpy.mockRestore();
      expect(result).toEqual({
        data: updatedProducerKeychain,
        metadata: { version: 2 },
      });
      const events = await readEvents(producerKeychain);
      expect(events).toHaveLength(3);
      expect(events[1]).toMatchObject({
        type: "ProducerKeychainNameUpdated",
        event_version: 2,
        version: "1",
        correlation_id: ctx.correlationId,
      });
      expect(events[2]).toMatchObject({
        type: "ProducerKeychainDescriptionUpdated",
        event_version: 2,
        version: "2",
        correlation_id: ctx.correlationId,
      });
      expect(
        decodeProtobufPayload({
          messageType: ProducerKeychainNameUpdatedV2,
          payload: events[1].data,
        })
      ).toEqual({
        producerKeychain: toProducerKeychainV2(updatedProducerKeychain),
      });
      expect(
        decodeProtobufPayload({
          messageType: ProducerKeychainDescriptionUpdatedV2,
          payload: events[2].data,
        })
      ).toEqual({
        producerKeychain: toProducerKeychainV2(updatedProducerKeychain),
      });
    }
  );

  it.each(changes)("should preserve omitted fields: %s", async (seed) => {
    const producerKeychain = getMockProducerKeychain();
    await addOneProducerKeychain(producerKeychain);
    const result = await authorizationService.updateProducerKeychain(
      { producerKeychainId: producerKeychain.id, seed },
      getMockContext({ authData: getMockAuthData(producerKeychain.producerId) })
    );
    const count = Object.keys(seed).length;
    expect(result).toEqual({
      data: { ...producerKeychain, ...seed },
      metadata: { version: count },
    });
    expect(await readEvents(producerKeychain)).toHaveLength(count + 1);
  });

  it.each(changes)(
    "should write events for supplied unchanged values: %s",
    async (seed) => {
      const producerKeychain = {
        ...getMockProducerKeychain(),
        name: "Updated name",
        description: "Updated description",
      };
      await addOneProducerKeychain(producerKeychain);
      const transactionSpy = vi.spyOn(postgresDB, "tx");
      transactionSpy.mockClear();
      const result = await authorizationService.updateProducerKeychain(
        { producerKeychainId: producerKeychain.id, seed },
        getMockContext({
          authData: getMockAuthData(producerKeychain.producerId),
        })
      );
      expect(transactionSpy).toHaveBeenCalledTimes(1);
      transactionSpy.mockRestore();
      expect(result).toEqual({
        data: producerKeychain,
        metadata: { version: Object.keys(seed).length },
      });
      const events = await readEvents(producerKeychain);
      expect(events).toHaveLength(Object.keys(seed).length + 1);
      expect(events.slice(1).map((event) => event.type)).toEqual([
        ...(seed.name !== undefined ? ["ProducerKeychainNameUpdated"] : []),
        ...(seed.description !== undefined
          ? ["ProducerKeychainDescriptionUpdated"]
          : []),
      ]);
    }
  );

  it.each([
    { name: "Updated name", description: "Original description" },
    { name: "Original name", description: "Updated description" },
  ])(
    "should emit events for changed and unchanged supplied fields: %s",
    async (seed) => {
      const producerKeychain = {
        ...getMockProducerKeychain(),
        name: "Original name",
        description: "Original description",
      };
      await addOneProducerKeychain(producerKeychain);
      const result = await authorizationService.updateProducerKeychain(
        { producerKeychainId: producerKeychain.id, seed },
        getMockContext({
          authData: getMockAuthData(producerKeychain.producerId),
        })
      );
      expect(result).toEqual({
        data: { ...producerKeychain, ...seed },
        metadata: { version: 2 },
      });
      const events = await readEvents(producerKeychain);
      expect(events).toHaveLength(3);
      expect(events.slice(1).map((event) => event.type)).toEqual([
        "ProducerKeychainNameUpdated",
        "ProducerKeychainDescriptionUpdated",
      ]);
    }
  );

  it("should advance the current nonzero version for a repeated M2M update", async () => {
    const producerKeychain = getMockProducerKeychain();
    await addOneProducerKeychain(producerKeychain);
    const ctx = getMockContextM2MAdmin({
      organizationId: producerKeychain.producerId,
    });
    const seed = { name: "Updated name" };
    const updated = await authorizationService.updateProducerKeychain(
      { producerKeychainId: producerKeychain.id, seed },
      ctx
    );
    await upsertProducerKeychain(
      readModelDB,
      updated.data,
      updated.metadata.version
    );
    expect(
      await authorizationService.updateProducerKeychain(
        { producerKeychainId: producerKeychain.id, seed },
        ctx
      )
    ).toEqual({ data: updated.data, metadata: { version: 2 } });
    const events = await readEvents(producerKeychain);
    expect(events).toHaveLength(3);
    expect(events.slice(1)).toMatchObject([
      {
        type: "ProducerKeychainNameUpdated",
        version: "1",
        correlation_id: ctx.correlationId,
      },
      {
        type: "ProducerKeychainNameUpdated",
        version: "2",
        correlation_id: ctx.correlationId,
      },
    ]);
  });

  it("should not require unique names", async () => {
    const producerKeychain = getMockProducerKeychain();
    const other = {
      ...getMockProducerKeychain({ producerId: producerKeychain.producerId }),
      name: "Existing name",
    };
    await addOneProducerKeychain(producerKeychain);
    await addOneProducerKeychain(other);
    const result = await authorizationService.updateProducerKeychain(
      { producerKeychainId: producerKeychain.id, seed: { name: other.name } },
      getMockContext({ authData: getMockAuthData(producerKeychain.producerId) })
    );
    expect(result.data.name).toBe(other.name);
  });

  it.each([false, true])(
    "should reject a non-owner even for unchanged values with m2m=%s",
    async (m2m) => {
      const producerKeychain = getMockProducerKeychain();
      await addOneProducerKeychain(producerKeychain);
      const organizationId = generateId<TenantId>();
      const ctx = m2m
        ? getMockContextM2MAdmin({ organizationId })
        : getMockContext({ authData: getMockAuthData(organizationId) });
      await expect(
        authorizationService.updateProducerKeychain(
          {
            producerKeychainId: producerKeychain.id,
            seed: { name: producerKeychain.name },
          },
          ctx
        )
      ).rejects.toThrowError(
        tenantNotAllowedOnProducerKeychain(organizationId, producerKeychain.id)
      );
      expect(await readEvents(producerKeychain)).toHaveLength(1);
    }
  );

  it("should reject a missing producer keychain", async () => {
    const producerKeychainId = generateId<ProducerKeychainId>();
    await expect(
      authorizationService.updateProducerKeychain(
        { producerKeychainId, seed: { name: "Updated name" } },
        getMockContext({})
      )
    ).rejects.toThrowError(producerKeychainNotFound(producerKeychainId));
  });

  it.each([
    { name: "https://example.com", description: "Updated description" },
    { name: "Updated name", description: "https://example.com" },
  ])(
    "should reject hyperlinks without persisting either change: %s",
    async (seed) => {
      const producerKeychain = getMockProducerKeychain();
      await addOneProducerKeychain(producerKeychain);
      await expect(
        authorizationService.updateProducerKeychain(
          { producerKeychainId: producerKeychain.id, seed },
          getMockContext({
            authData: getMockAuthData(producerKeychain.producerId),
          })
        )
      ).rejects.toThrowError(hyperlinkDetectionError("https://example.com"));
      expect(await readEvents(producerKeychain)).toHaveLength(1);
    }
  );

  it("should reject a stale write without retrying", async () => {
    const producerKeychain = getMockProducerKeychain();
    await addOneProducerKeychain(producerKeychain);
    const ctx = getMockContext({
      authData: getMockAuthData(producerKeychain.producerId),
    });
    await authorizationService.updateProducerKeychain(
      {
        producerKeychainId: producerKeychain.id,
        seed: { name: "First update" },
      },
      ctx
    );
    await expect(
      authorizationService.updateProducerKeychain(
        {
          producerKeychainId: producerKeychain.id,
          seed: { name: "Second update" },
        },
        ctx
      )
    ).rejects.toThrowError(
      eventConflictError(ctx.correlationId, producerKeychain.id, 0)
    );
    expect(await readEvents(producerKeychain)).toHaveLength(2);
  });

  it("should roll back the first event when the second conflicts", async () => {
    const producerKeychain = getMockProducerKeychain();
    await addOneProducerKeychain(producerKeychain);
    await writeInEventstore(
      {
        stream_id: producerKeychain.id,
        version: 2,
        event: {
          type: "ProducerKeychainNameUpdated",
          event_version: 2,
          data: { producerKeychain: toProducerKeychainV2(producerKeychain) },
        },
      },
      '"authorization"',
      postgresDB
    );
    const ctx = getMockContext({
      authData: getMockAuthData(producerKeychain.producerId),
    });
    await expect(
      authorizationService.updateProducerKeychain(
        {
          producerKeychainId: producerKeychain.id,
          seed: { name: "Updated name", description: "Updated description" },
        },
        ctx
      )
    ).rejects.toThrowError(
      eventConflictError(ctx.correlationId, producerKeychain.id, 1)
    );
    expect(
      (await readEvents(producerKeychain)).map((event) => event.version)
    ).toEqual(["0", "2"]);
  });
});
