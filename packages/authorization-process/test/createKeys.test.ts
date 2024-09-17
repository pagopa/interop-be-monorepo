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
  invalidKey,
  notAllowedCertificateException,
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
    const key: Key = {
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
    const key: Key = {
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
  it("should throw notAllowedCertificateException if the key contains a certificate", async () => {
    mockSelfcareV2ClientCall([mockSelfCareUsers]);

    await addOneClient(mockClient);

    const cert = `
      LS0tLS1CRUdJTiBDRVJUSUZJQ0FURS0tLS0tCk1JSUZDekNDQS9PZ0F3SUJBZ0lTQkVSdi9yT3plelZuVWR4RWllVWY4OWpvTUEwR0NTcUdTSWIzRFFFQkN3VUEKTURNeEN6QUpCZ05WQkFZVEFsVlRNUll3RkFZRFZRUUtFdzFNWlhRbmN5QkZibU55ZVhCME1Rd3dDZ1lEVlFRRApFd05TTVRFd0hoY05NalF3TnpJM01ETXlNVFE0V2hjTk1qUXhNREkxTURNeU1UUTNXakFwTVNjd0pRWURWUVFECkV4NXRhV05rYkdkdmRuZGhlV05zYVdWdWRDNXdjQzVqYVc1bFkyRXVhWFF3Z2dFaU1BMEdDU3FHU0liM0RRRUIKQVFVQUE0SUJEd0F3Z2dFS0FvSUJBUUMyL0JWRVBaNVFHbFd6VzQrbU5VVGNscmVhNnRoSkpWTmVQazM0TzZ5RgpWOXcvQ3lSRkpNYzdSN3gxNjNBVVRwYTc4bWx4Uzd6c1NMSzNBU1dHSFBIczFqZlVHYWMrL2Rya25ySkVVSXEwCnhzNXBNZWpzek41eUxUd3BnekE3TGsvUXFrK2htRmdlVTB2d2FwcEJoc1RlT2F5UnRqQlpJcmZSSWNPV0VnZysKb1lVbGFJS1dmMWh4R2J2VFgyWURYY2ltYUZLeHVrOVdML2creklCR2d4N3oyRUpEekZDQlpoOHBqdmR4VE1SbApjOU9yTlFOUWVvWVhhcDc0eFZrVThYNEkxbUR0K1R1N1FVcnQwd0VYdVhnZFptbEdrQ1AybWdXNis4S0gvNFhqCmZsRzZzR1M2OVFmYkxYZ05pbGk2UUdLT1dGbWc1dVBTbEZZV0tPbTJQU1hyQWdNQkFBR2pnZ0loTUlJQ0hUQU8KQmdOVkhROEJBZjhFQkFNQ0JhQXdIUVlEVlIwbEJCWXdGQVlJS3dZQkJRVUhBd0VHQ0NzR0FRVUZCd01DTUF3RwpBMVVkRXdFQi93UUNNQUF3SFFZRFZSME9CQllFRktwZ0lCc1lZVWFDcktBVlptYi80NGZYU2FhMk1COEdBMVVkCkl3UVlNQmFBRk1YUFJxVHE5TVBBZW15VnhDMndYcEl2SnVPNU1GY0dDQ3NHQVFVRkJ3RUJCRXN3U1RBaUJnZ3IKQmdFRkJRY3dBWVlXYUhSMGNEb3ZMM0l4TVM1dkxteGxibU55TG05eVp6QWpCZ2dyQmdFRkJRY3dBb1lYYUhSMApjRG92TDNJeE1TNXBMbXhsYm1OeUxtOXlaeTh3S1FZRFZSMFJCQ0l3SUlJZWJXbGpaR3huYjNaM1lYbGpiR2xsCmJuUXVjSEF1WTJsdVpXTmhMbWwwTUJNR0ExVWRJQVFNTUFvd0NBWUdaNEVNQVFJQk1JSUJBd1lLS3dZQkJBSFcKZVFJRUFnU0I5QVNCOFFEdkFIWUFQeGRMVDljaVIxaVVIV1VjaEw0TkV1MlFOMzhmaFdycndiOG9oZXo0Wkc0QQpBQUdROG14bXhnQUFCQU1BUnpCRkFpQjVuZDdUeUV2K0w4bG84TW1qRHF5RzBQZTJnWW1iajJVTEx1bHFLTFdjClNRSWhBSXN2cktMOTI3TlZ3OEM3eWpoQTRaY29kTXVJYStYcktSUFBuei93eVp1NEFIVUE3czNRWk5YYkdzN0YKWExlZHRNMFRvaktIUm55ODdON0RVVWhaUm5FZnRac0FBQUdROG14bXpnQUFCQU1BUmpCRUFpQnkxSHh4eFR1TAo4SFdYVzBlQUJuUGtjWWQ1aC9hYy80UXdSQ2hZOWxiMm9RSWdQNG51Ui9Vdy8rejZsWXgwWTdCUXpQbE1ON3lICmlSZmIvMkZLYmlGejNmUXdEUVlKS29aSWh2Y05BUUVMQlFBRGdnRUJBQXRqbU92NFVpbUdINnY5YmtRWnkzV2IKeDQ3Tk80VmNiRVovNWkraGhHNmI5aHFGbUpQSWpDbWYrVnF4T2FKTnJwMU9ONGtjeTBjS05KRFB6NHNIU3NPVgo4d0ZqTXRpMUtQK2dSdE5sQWhUc2VLRlRxUjYvbkZ1Z2VRbzdDM3ZVOGpYSHNYSWVaL1J5NmVsd2VVWlBGbmw2CkNrc2ZYL3BXMTZOQnN0SW1aRnFxMmo1aGZZbDE2c0dUZCtXTnlhczFiZzlobit6dXZZZ1REeEpiTzVaOCt3aTUKeTJiVVBQTzdkQ05YWTM5cW1TYW5INDRtYXpyY0Q5KzJVbXpiRXFGUWJBeG1PSmJXN0c4dVpjRE9sZldPWktzTgo4RzIrcTE3citXTDZ3VEVvcmF6V3dSdVY0ZTdCOWxCWWdYUGZmVi9iV1RtZ2Z0bi95L0xTYWpISHNBRkZmQ289Ci0tLS0tRU5EIENFUlRJRklDQVRFLS0tLS0=`;

    expect(
      authorizationService.createKeys({
        clientId: mockClient.id,
        authData: mockAuthData,
        keysSeeds: [
          {
            ...keySeed,
            key: cert,
          },
        ],
        correlationId: generateId(),
        logger: genericLogger,
      })
    ).rejects.toThrowError(notAllowedCertificateException());
  });
});
