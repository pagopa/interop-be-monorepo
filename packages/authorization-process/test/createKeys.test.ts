/* eslint-disable functional/no-let */
/* eslint-disable @typescript-eslint/no-floating-promises */
import crypto from "crypto";
import { describe, it, vi, beforeAll, afterAll, expect } from "vitest";
import {
  Client,
  ClientKeyAddedV2,
  Key,
  TenantId,
  UserId,
  generateId,
  notAllowedPrivateKeyException,
  toClientV2,
} from "pagopa-interop-models";
import { AuthData, genericLogger } from "pagopa-interop-commons";
import {
  decodeProtobufPayload,
  getMockKey,
  readLastEventByStreamId,
} from "pagopa-interop-commons-test/index.js";
import { getMockClient } from "pagopa-interop-commons-test";
import { selfcareV2Client } from "pagopa-interop-selfcare-v2-client";
import { ApiKeySeed, ApiKeysSeed } from "../src/model/domain/models.js";
import {
  clientNotFound,
  keyAlreadyExists,
  organizationNotAllowedOnClient,
  securityUserNotFound,
  tooManyKeysPerClient,
  userNotFound,
} from "../src/model/domain/errors.js";
import {
  calculateKid,
  createJWK,
  decodeBase64ToPem,
} from "../../commons/src/auth/jwk.js";
import { addOneClient, authorizationService, postgresDB } from "./utils.js";

describe("createKeys", () => {
  const consumerId: TenantId = generateId();
  const userId: UserId = generateId();

  beforeAll(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  const key = crypto.generateKeyPairSync("rsa", {
    modulusLength: 2048,
  }).publicKey;

  const pemKey = Buffer.from(
    key.export({ type: "pkcs1", format: "pem" })
  ).toString("base64");

  const keySeed: ApiKeySeed = {
    name: "key seed",
    use: "ENC",
    key: pemKey,
    alg: "",
  };

  const keysSeeds: ApiKeysSeed = [keySeed];

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

  const mockAuthData: AuthData = {
    organizationId: consumerId,
    selfcareId: generateId(),
    externalId: {
      value: "",
      origin: "",
    },
    userId,
    userRoles: [],
  };

  const mockClient: Client = {
    ...getMockClient(),
    users: [userId],
    consumerId,
  };

  it("should create the keys and add them to the client", async () => {
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
      mockAuthData,
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
      version: "1",
      type: "ClientKeyAdded",
      event_version: 2,
    });

    const writtenPayload = decodeProtobufPayload({
      messageType: ClientKeyAddedV2,
      payload: writtenEvent.data,
    });

    const expectedClient: Client = {
      ...mockClient,
      keys: [
        {
          name: keySeed.name,
          createdAt: new Date(),
          kid: writtenPayload.kid,
          encodedPem: keySeed.key,
          algorithm: keySeed.alg,
          use: "Enc",
          userId,
        },
      ],
    };
    expect(writtenPayload.client).toEqual(toClientV2(expectedClient));
  });
  it("should throw clientNotFound if the client doesn't exist ", async () => {
    await addOneClient(getMockClient());
    mockSelfcareV2ClientCall([mockSelfCareUsers]);
    expect(
      authorizationService.createKeys(
        mockClient.id,
        mockAuthData,
        keysSeeds,
        generateId(),
        genericLogger
      )
    ).rejects.toThrowError(clientNotFound(mockClient.id));
  });
  it("should throw organizationNotAllowedOnClient if the requester is not the consumer", async () => {
    const notConsumerClient: Client = {
      ...getMockClient(),
      consumerId: generateId(),
    };

    await addOneClient(notConsumerClient);
    mockSelfcareV2ClientCall([mockSelfCareUsers]);

    expect(
      authorizationService.createKeys(
        notConsumerClient.id,
        mockAuthData,
        keysSeeds,
        generateId(),
        genericLogger
      )
    ).rejects.toThrowError(
      organizationNotAllowedOnClient(consumerId, notConsumerClient.id)
    );
  });
  it("should throw securityUserNotFound if the Security user is not found", async () => {
    await addOneClient(mockClient);

    mockSelfcareV2ClientCall([]);

    expect(
      authorizationService.createKeys(
        mockClient.id,
        mockAuthData,
        keysSeeds,
        generateId(),
        genericLogger
      )
    ).rejects.toThrowError(securityUserNotFound(mockAuthData.userId, userId));
  });
  it("should throw tooManyKeysPerClient if the keys number is greater than maxKeysPerClient ", async () => {
    function get100Keys(): Key[] {
      const arrayKeys = [];
      for (let index = 0; index < 101; index++) {
        arrayKeys.push(getMockKey());
      }
      return arrayKeys;
    }
    const clientWith100Keys: Client = {
      ...getMockClient(),
      keys: get100Keys(),
      consumerId,
      users: [userId],
    };

    mockSelfcareV2ClientCall([mockSelfCareUsers]);

    await addOneClient(clientWith100Keys);

    vi.mock("pagopa-interop-selfcare-v2-client", () => ({
      selfcareV2Client: {
        getInstitutionProductUsersUsingGET: (): Promise<boolean> =>
          Promise.resolve(true),
      },
    }));

    expect(
      authorizationService.createKeys(
        clientWith100Keys.id,
        mockAuthData,
        keysSeeds,
        generateId(),
        genericLogger
      )
    ).rejects.toThrowError(
      tooManyKeysPerClient(
        clientWith100Keys.id,
        clientWith100Keys.keys.length + keysSeeds.length
      )
    );
  });
  it("should throw userNotFound if the user doesn't exist ", async () => {
    const noUsersClient: Client = {
      ...getMockClient(),
      consumerId,
    };

    await addOneClient(noUsersClient);
    mockSelfcareV2ClientCall([mockSelfCareUsers]);
    expect(
      authorizationService.createKeys(
        noUsersClient.id,
        mockAuthData,
        keysSeeds,
        generateId(),
        genericLogger
      )
    ).rejects.toThrowError(
      userNotFound(mockAuthData.userId, mockAuthData.selfcareId)
    );
  });
  it("should throw notAllowedPrivateKeyException if the key is a private key", async () => {
    const privateKey = crypto.generateKeyPairSync("rsa", {
      modulusLength: 2048,
    }).privateKey;

    const privatePemKey = Buffer.from(
      privateKey.export({ type: "pkcs1", format: "pem" })
    ).toString("base64");

    const keySeedByPrivateKey: ApiKeySeed = {
      name: "key seed",
      use: "ENC",
      key: privatePemKey,
      alg: "",
    };

    const keysSeeds: ApiKeysSeed = [keySeedByPrivateKey];

    await addOneClient(mockClient);
    mockSelfcareV2ClientCall([mockSelfCareUsers]);
    expect(
      authorizationService.createKeys(
        mockClient.id,
        mockAuthData,
        keysSeeds,
        generateId(),
        genericLogger
      )
    ).rejects.toThrowError(notAllowedPrivateKeyException());
  });
  it("should throw keyAlreadyExists if the kid already exist in  the client keys ", async () => {
    const duplicatedKidClient: Client = {
      ...getMockClient(),
      keys: [
        {
          ...getMockKey(),
          kid: calculateKid(createJWK(decodeBase64ToPem(keySeed.key))),
        },
      ],
      consumerId,
      users: [userId],
    };

    await addOneClient(duplicatedKidClient);
    mockSelfcareV2ClientCall([mockSelfCareUsers]);
    expect(
      authorizationService.createKeys(
        duplicatedKidClient.id,
        mockAuthData,
        keysSeeds,
        generateId(),
        genericLogger
      )
    ).rejects.toThrowError(keyAlreadyExists(duplicatedKidClient.keys[0].kid));
  });
});
