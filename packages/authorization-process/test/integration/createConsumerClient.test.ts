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

describe("createConsumerClient", () => {
  const organizationId: TenantId = generateId();

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
    members: [organizationId],
  };
  it("should write on event-store for the creation of a consumer client", async () => {
    const client = await authorizationService.createConsumerClient(
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
      kind: clientKind.consumer,
      purposes: [],
      users: clientSeed.members.map(unsafeBrandId<UserId>),
      description: clientSeed.description,
    };

    expect(writtenPayload.client).toEqual(toClientV2(expectedClient));
    expect(client).toEqual(expectedClient);
  });
});
