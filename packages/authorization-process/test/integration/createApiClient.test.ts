import { describe, it, vi, beforeAll, afterAll, expect } from "vitest";
import {
  Client,
  ClientAddedV2,
  TenantId,
  UserId,
  clientKind,
  generateId,
  toClientV2,
  unsafeBrandId,
} from "pagopa-interop-models";
import {
  decodeProtobufPayload,
  getMockAuthData,
  getMockContext,
  readLastEventByStreamId,
} from "pagopa-interop-commons-test";
import { authorizationApi } from "pagopa-interop-api-clients";
import { authorizationService, postgresDB } from "../integrationUtils.js";
import { duplicatedMembersInSeed } from "../../src/model/domain/errors.js";

describe("createConsumerClient", () => {
  const userId: UserId = generateId();

  beforeAll(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  const clientSeed: authorizationApi.ClientSeed = {
    name: "Seed name",
    description: "Description",
    members: [userId],
  };
  it("should write on event-store for the creation of a api client", async () => {
    const organizationId: TenantId = generateId();
    const client = await authorizationService.createApiClient(
      {
        clientSeed,
      },
      getMockContext({ authData: getMockAuthData(organizationId) })
    );

    const writtenEvent = await readLastEventByStreamId(
      client.id,
      '"authorization"',
      postgresDB
    );

    expect(writtenEvent).toMatchObject({
      stream_id: client.id,
      version: "0",
      type: "ClientAdded",
      event_version: 2,
    });

    const writtenPayload = decodeProtobufPayload({
      messageType: ClientAddedV2,
      payload: writtenEvent.data,
    });

    const expectedClient: Client = {
      id: client.id,
      keys: [],
      name: clientSeed.name,
      createdAt: new Date(),
      consumerId: organizationId,
      kind: clientKind.api,
      purposes: [],
      users: [unsafeBrandId<UserId>(userId)],
      description: clientSeed.description,
    };

    expect(writtenPayload).toEqual({
      client: toClientV2(expectedClient),
    });
    expect(client).toEqual(expectedClient);
  });

  it("Should fail if duplicate users are passed in the seed", async () => {
    const userId = generateId();
    const seed = {
      ...clientSeed,
      members: [userId, userId, generateId()],
    };
    const organizationId: TenantId = generateId();

    const error = duplicatedMembersInSeed();
    await expect(
      authorizationService.createApiClient(
        { clientSeed: seed },
        getMockContext({ authData: getMockAuthData(organizationId) })
      )
    ).rejects.toThrowError(error);
  });
});
