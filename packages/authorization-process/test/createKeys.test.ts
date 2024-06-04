import { describe, it, vi, beforeAll, afterAll, expect } from "vitest";
import {
  Client,
  ClientKeyAddedV2,
  TenantId,
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
import { getMockClient, getRandomAuthData } from "pagopa-interop-commons-test";
import { selfcareV2Client } from "pagopa-interop-selfcare-v2-client";
import { ApiKeySeed, ApiKeysSeed } from "../src/model/domain/models.js";
import { addOneClient, authorizationService, postgresDB } from "./utils.js";

describe("createKeys", () => {
  const consumerId: TenantId = generateId();

  const organizationId = generateId();

  beforeAll(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  const keySeed: ApiKeySeed = {
    name: "key seed",
    use: "ENC",
    key: "TXkgcHVibGljIGtleQ==",
    alg: "",
  };

  const keysSeeds: ApiKeysSeed = [keySeed];

  const mockClient: Client = {
    ...getMockClient(),
    consumerId: unsafeBrandId(organizationId),
  };

  function mockSelfcareV2ClientCall(
    value: Awaited<
      ReturnType<typeof selfcareV2Client.getInstitutionProductUsersUsingGET>
    >
  ): void {
    vi.spyOn(
      selfcareV2Client,
      "getInstitutionProductUsersUsingGET"
    ).mockImplementationOnce(() => Promise.resolve(value));
  }

  const mockSelfCareUsers = {
    id: generateId(),
    name: "test",
    roles: [],
    email: "test@test.it",
    surname: "surname_test",
  };

  it("should create the fkg keys", async () => {
    mockSelfcareV2ClientCall([mockSelfCareUsers]);

    await addOneClient(mockClient);

    vi.mock("pagopa-interop-selfcare-v2-client", () => ({
      selfcareV2Client: {
        getInstitutionProductUsersUsingGET: (): Promise<boolean> =>
          Promise.resolve(true),
      },
    }));
    const { client } = await authorizationService.createKeys(
      mockClient.id,
      getRandomAuthData(consumerId),
      keysSeeds,
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
      type: "KeysAdded",
      event_version: 2,
    });

    const writtenPayload = decodeProtobufPayload({
      messageType: ClientKeyAddedV2,
      payload: writtenEvent.data,
    });

    const expectedKeys: Key[] = [{}];

    expect(writtenPayload.client).toEqual(toClientV2(expectedClient));
  });
});
