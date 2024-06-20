import { describe, it, vi, beforeAll, afterAll, expect } from "vitest";
import {
  Client,
  ClientAddedV2,
  UserId,
  clientKind,
  generateId,
  toClientV2,
  unsafeBrandId,
} from "pagopa-interop-models";
import { genericLogger } from "pagopa-interop-commons";
import {
  decodeProtobufPayload,
  readLastEventByStreamId,
} from "pagopa-interop-commons-test/index.js";
import { ApiClientSeed } from "../src/model/domain/models.js";
import { authorizationService, postgresDB } from "./utils.js";

describe("createConsumerClient", () => {
  const organizationId = generateId();

  beforeAll(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  const clientSeed: ApiClientSeed = {
    name: "Seed name",
    description: "Description",
    members: [organizationId],
  };
  it("should write on event-store for the creation of a consumer client", async () => {
    const { client } = await authorizationService.createConsumerClient(
      clientSeed,
      unsafeBrandId(organizationId),
      generateId(),
      genericLogger
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
      consumerId: unsafeBrandId(organizationId),
      kind: clientKind.consumer,
      purposes: [],
      users: clientSeed.members.map(unsafeBrandId<UserId>),
      description: clientSeed.description,
    };

    expect(writtenPayload.client).toEqual(toClientV2(expectedClient));
  });
});
