/* eslint-disable functional/no-let */
/* eslint-disable @typescript-eslint/no-floating-promises */
import crypto from "crypto";
import { describe, it, vi, beforeAll, afterAll, expect } from "vitest";
import {
  Client,
  ClientKeyAddedV2,
  ClientKey,
  TenantId,
  UserId,
  generateId,
  invalidKey,
  notAllowedPrivateKeyException,
  toClientV2,
} from "pagopa-interop-models";
import {
  AuthData,
  calculateKid,
  createJWK,
  genericLogger,
} from "pagopa-interop-commons";
import {
  decodeProtobufPayload,
  getMockKey,
  readLastEventByStreamId,
} from "pagopa-interop-commons-test/index.js";
import { getMockClient } from "pagopa-interop-commons-test";
import {
  authorizationApi,
  selfcareV2ClientApi,
} from "pagopa-interop-api-clients";
import {
  clientNotFound,
  keyAlreadyExists,
  organizationNotAllowedOnClient,
  tooManyKeysPerClient,
  userNotFound,
  userWithoutSecurityPrivileges,
} from "../src/model/domain/errors.js";
import {
  addOneClient,
  authorizationService,
  postgresDB,
  selfcareV2Client,
} from "./utils.js";

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

  const base64Key = Buffer.from(
    key.export({ type: "pkcs1", format: "pem" })
  ).toString("base64url");

  const keySeed: authorizationApi.KeySeed = {
    name: "key seed",
    use: "ENC",
    key: base64Key,
    alg: "",
  };

  const keysSeeds: authorizationApi.KeysSeed = [keySeed];

  function mockSelfcareV2ClientCall(
    value: Awaited<
      ReturnType<typeof selfcareV2Client.getInstitutionProductUsersUsingGET>
    >
  ): void {
    selfcareV2Client.getInstitutionProductUsersUsingGET = vi.fn(
      async () => value
    );
  }

  const mockSelfCareUsers: selfcareV2ClientApi.UserResource = {
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

    const { client } = await authorizationService.createKeys({
      clientId: mockClient.id,
      authData: mockAuthData,
      keysSeeds,
      correlationId: generateId(),
      logger: genericLogger,
    });

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
          clientId: mockClient.id,
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
      authorizationService.createKeys({
        clientId: mockClient.id,
        authData: mockAuthData,
        keysSeeds,
        correlationId: generateId(),
        logger: genericLogger,
      })
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
      authorizationService.createKeys({
        clientId: notConsumerClient.id,
        authData: mockAuthData,
        keysSeeds,
        correlationId: generateId(),
        logger: genericLogger,
      })
    ).rejects.toThrowError(
      organizationNotAllowedOnClient(consumerId, notConsumerClient.id)
    );
  });
  it("should throw userWithoutSecurityPrivileges if the Security user is not found", async () => {
    await addOneClient(mockClient);

    mockSelfcareV2ClientCall([]);

    expect(
      authorizationService.createKeys({
        clientId: mockClient.id,
        authData: mockAuthData,
        keysSeeds,
        correlationId: generateId(),
        logger: genericLogger,
      })
    ).rejects.toThrowError(
      userWithoutSecurityPrivileges(mockAuthData.organizationId, userId)
    );
  });
  it("should throw tooManyKeysPerClient if the keys number is greater than maxKeysPerClient ", async () => {
    function get100Keys(): ClientKey[] {
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

    expect(
      authorizationService.createKeys({
        clientId: clientWith100Keys.id,
        authData: mockAuthData,
        keysSeeds,
        correlationId: generateId(),
        logger: genericLogger,
      })
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
      authorizationService.createKeys({
        clientId: noUsersClient.id,
        authData: mockAuthData,
        keysSeeds,
        correlationId: generateId(),
        logger: genericLogger,
      })
    ).rejects.toThrowError(
      userNotFound(mockAuthData.userId, mockAuthData.selfcareId)
    );
  });
  it("should throw notAllowedPrivateKeyException if the key is a private key", async () => {
    const privateKey = crypto.generateKeyPairSync("rsa", {
      modulusLength: 2048,
    }).privateKey;

    const privateBase64Key = Buffer.from(
      privateKey.export({ type: "pkcs1", format: "pem" })
    ).toString("base64url");

    const keySeedByPrivateKey: authorizationApi.KeySeed = {
      name: "key seed",
      use: "ENC",
      key: privateBase64Key,
      alg: "",
    };

    const keysSeeds: authorizationApi.KeysSeed = [keySeedByPrivateKey];

    await addOneClient(mockClient);
    mockSelfcareV2ClientCall([mockSelfCareUsers]);
    expect(
      authorizationService.createKeys({
        clientId: mockClient.id,
        authData: mockAuthData,
        keysSeeds,
        correlationId: generateId(),
        logger: genericLogger,
      })
    ).rejects.toThrowError(notAllowedPrivateKeyException());
  });
  it("should throw keyAlreadyExists if the kid already exists in the keys of that client ", async () => {
    const key: ClientKey = {
      ...getMockKey(),
      kid: calculateKid(createJWK(keySeed.key)),
    };

    const clientWithDuplicateKey: Client = {
      ...mockClient,
      keys: [key],
    };
    await addOneClient(clientWithDuplicateKey);
    mockSelfcareV2ClientCall([mockSelfCareUsers]);

    expect(
      authorizationService.createKeys({
        clientId: clientWithDuplicateKey.id,
        authData: mockAuthData,
        keysSeeds,
        correlationId: generateId(),
        logger: genericLogger,
      })
    ).rejects.toThrowError(keyAlreadyExists(key.kid));
  });
  it("should throw keyAlreadyExists if the kid already exists in the keys of a different client ", async () => {
    const key: ClientKey = {
      ...getMockKey(),
      kid: calculateKid(createJWK(keySeed.key)),
    };

    const client: Client = {
      ...mockClient,
      id: generateId(),
    };

    const clientWithDuplicateKey: Client = {
      ...mockClient,
      id: generateId(),
      keys: [key],
    };
    await addOneClient(client);
    await addOneClient(clientWithDuplicateKey);

    mockSelfcareV2ClientCall([mockSelfCareUsers]);

    expect(
      authorizationService.createKeys({
        clientId: client.id,
        authData: mockAuthData,
        keysSeeds,
        correlationId: generateId(),
        logger: genericLogger,
      })
    ).rejects.toThrowError(keyAlreadyExists(key.kid));
  });
  it("should throw invalidKey if the key is not an RSA key", async () => {
    const notRSAKey = crypto.generateKeyPairSync("ed25519", {
      modulusLength: 2048,
    }).publicKey;

    const notRSABase64Key = Buffer.from(
      notRSAKey.export({ type: "spki", format: "pem" })
    ).toString("base64url");

    const keySeed: authorizationApi.KeySeed = {
      name: "key seed",
      use: "ENC",
      key: notRSABase64Key,
      alg: "",
    };

    const keysSeeds: authorizationApi.KeysSeed = [keySeed];

    await addOneClient(mockClient);
    mockSelfcareV2ClientCall([mockSelfCareUsers]);
    expect(
      authorizationService.createKeys({
        clientId: mockClient.id,
        authData: mockAuthData,
        keysSeeds,
        correlationId: generateId(),
        logger: genericLogger,
      })
    ).rejects.toThrowError(invalidKey(keySeed.key, "Not an RSA key"));
  });
  it("should throw invalidKey if the key doesn't have the delimiters", async () => {
    const keySeed: authorizationApi.KeySeed = {
      name: "key seed",
      use: "ENC",
      key: `Ck1JSUJDZ0tDQVFFQXF1c1hpYUtuR2RmbnZyZ21WNDlGK2lJR0lOa0tUQ0FJQTZ0d3NVUzNzaWVxdXlQRk80QmMKcVhZSUE2cXZyWDJxc21hOElTS2RMbkt5azBFNXczQ0JOZmZCcUs2ZE9pYm5xZGxEVndnZDZEWm1HY2VWWWFoYQp6QnpqbFdXcllmNEUrTUNvZ1FiUEFYTytOa0Z0M1c3cVhMTFFCYzBYTXlIelQzTlBtQlpJTktRMS9hd05iR3dYCnJJSGlyVnBqZHVpNzJRb3hjR1VBMW5JallRTW9iQ3VBMHg1L3dFL29KblFZZ1g1NVg3SnRKaTQ2dmx0VlpiVVMKckZiWkdlRUIzMEF1NUV6a0U0NUpLVGpTZnVmclJEZDJzcFByKzJiYmFibFFsY1lSYnloaHVpeVR2cU1pSGZmKwplZ2JJNGpseVFSTExhUXdEeThzOHd2NDNWNUtzNmtmVGVRSURBUUFCCgo=`,
      alg: "",
    };

    const keysSeeds: authorizationApi.KeysSeed = [keySeed];

    await addOneClient(mockClient);
    mockSelfcareV2ClientCall([mockSelfCareUsers]);
    expect(
      authorizationService.createKeys({
        clientId: mockClient.id,
        authData: mockAuthData,
        keysSeeds,
        correlationId: generateId(),
        logger: genericLogger,
      })
    ).rejects.toThrowError(
      invalidKey(keySeed.key, "error:1E08010C:DECODER routines::unsupported")
    );
  });
});
