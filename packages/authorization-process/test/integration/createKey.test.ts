import crypto from "crypto";
import { describe, it, vi, beforeAll, afterAll, expect } from "vitest";
import {
  Client,
  ClientKeyAddedV2,
  Key,
  ProducerKeychain,
  TenantId,
  UserId,
  generateId,
  invalidKeyLength,
  invalidPublicKey,
  notAllowedCertificateException,
  notAllowedMultipleKeysException,
  notAllowedPrivateKeyException,
  notAnRSAKey,
  toClientV2,
} from "pagopa-interop-models";
import { AuthData, calculateKid, createJWK } from "pagopa-interop-commons";
import {
  decodeProtobufPayload,
  getMockAuthData,
  getMockContext,
  getMockKey,
  getMockProducerKeychain,
  readLastEventByStreamId,
} from "pagopa-interop-commons-test";
import { getMockClient } from "pagopa-interop-commons-test";
import {
  authorizationApi,
  selfcareV2ClientApi,
} from "pagopa-interop-api-clients";
import {
  clientNotFound,
  keyAlreadyExists,
  tenantNotAllowedOnClient,
  tooManyKeysPerClient,
  userNotFound,
  userWithoutSecurityPrivileges,
} from "../../src/model/domain/errors.js";
import {
  addOneClient,
  addOneProducerKeychain,
  authorizationService,
  postgresDB,
  selfcareV2Client,
} from "../integrationUtils.js";

describe("createKey", () => {
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
    key.export({ type: "spki", format: "pem" })
  ).toString("base64url");

  const keySeed: authorizationApi.KeySeed = {
    name: "key seed",
    use: "ENC",
    key: base64Key,
    alg: "",
  };

  function mockSelfcareV2ClientCall(
    value: Awaited<
      ReturnType<typeof selfcareV2Client.getInstitutionUsersByProductUsingGET>
    >
  ): void {
    selfcareV2Client.getInstitutionUsersByProductUsingGET = vi.fn(
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

  const mockAuthData: AuthData = getMockAuthData(consumerId, userId);

  const mockClient: Client = {
    ...getMockClient(),
    users: [userId],
    consumerId,
  };

  it("should create the keys and add them to the client", async () => {
    mockSelfcareV2ClientCall([mockSelfCareUsers]);

    await addOneClient(mockClient);

    const key = await authorizationService.createKey(
      {
        clientId: mockClient.id,
        keySeed,
      },
      getMockContext({ authData: mockAuthData })
    );

    const client: Client = { ...mockClient, keys: [key] };

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
        ...mockClient.keys,
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
    await expect(
      authorizationService.createKey(
        {
          clientId: mockClient.id,
          keySeed,
        },
        getMockContext({ authData: mockAuthData })
      )
    ).rejects.toThrowError(clientNotFound(mockClient.id));
  });
  it("should throw tenantNotAllowedOnClient if the requester is not the consumer", async () => {
    const notConsumerClient: Client = {
      ...getMockClient(),
      consumerId: generateId(),
    };

    await addOneClient(notConsumerClient);
    mockSelfcareV2ClientCall([mockSelfCareUsers]);

    await expect(
      authorizationService.createKey(
        {
          clientId: notConsumerClient.id,
          keySeed,
        },
        getMockContext({ authData: mockAuthData })
      )
    ).rejects.toThrowError(
      tenantNotAllowedOnClient(consumerId, notConsumerClient.id)
    );
  });
  it("should throw userWithoutSecurityPrivileges if the Security user is not found", async () => {
    await addOneClient(mockClient);

    mockSelfcareV2ClientCall([]);

    await expect(
      authorizationService.createKey(
        {
          clientId: mockClient.id,
          keySeed,
        },
        getMockContext({ authData: mockAuthData })
      )
    ).rejects.toThrowError(
      userWithoutSecurityPrivileges(mockAuthData.organizationId, userId)
    );
  });
  it("should throw tooManyKeysPerClient if the keys number is greater than maxKeysPerClient ", async () => {
    const clientWith100Keys: Client = {
      ...getMockClient(),
      keys: Array.from({ length: 100 }, () => getMockKey()),
      consumerId,
      users: [userId],
    };

    mockSelfcareV2ClientCall([mockSelfCareUsers]);

    await addOneClient(clientWith100Keys);

    await expect(
      authorizationService.createKey(
        {
          clientId: clientWith100Keys.id,
          keySeed,
        },
        getMockContext({ authData: mockAuthData })
      )
    ).rejects.toThrowError(
      tooManyKeysPerClient(
        clientWith100Keys.id,
        clientWith100Keys.keys.length + 1
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
    await expect(
      authorizationService.createKey(
        {
          clientId: noUsersClient.id,
          keySeed,
        },
        getMockContext({ authData: mockAuthData })
      )
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

    await addOneClient(mockClient);
    mockSelfcareV2ClientCall([mockSelfCareUsers]);
    await expect(
      authorizationService.createKey(
        {
          clientId: mockClient.id,
          keySeed: keySeedByPrivateKey,
        },
        getMockContext({ authData: mockAuthData })
      )
    ).rejects.toThrowError(notAllowedPrivateKeyException());
  });
  it("should throw keyAlreadyExists if the kid already exists in the keys of that client ", async () => {
    const key: Key = {
      ...getMockKey(),
      kid: calculateKid(createJWK({ pemKeyBase64: keySeed.key })),
    };

    const clientWithDuplicateKey: Client = {
      ...mockClient,
      keys: [key],
    };
    await addOneClient(clientWithDuplicateKey);
    mockSelfcareV2ClientCall([mockSelfCareUsers]);

    await expect(
      authorizationService.createKey(
        {
          clientId: clientWithDuplicateKey.id,
          keySeed,
        },
        getMockContext({ authData: mockAuthData })
      )
    ).rejects.toThrowError(keyAlreadyExists(key.kid));
  });
  it("should throw keyAlreadyExists if the kid already exists in the keys of a different client ", async () => {
    const key: Key = {
      ...getMockKey(),
      kid: calculateKid(createJWK({ pemKeyBase64: keySeed.key })),
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

    await expect(
      authorizationService.createKey(
        {
          clientId: client.id,
          keySeed,
        },
        getMockContext({ authData: mockAuthData })
      )
    ).rejects.toThrowError(keyAlreadyExists(key.kid));
  });
  it("should throw keyAlreadyExists if the kid already exists in a keychain", async () => {
    const key: Key = {
      ...getMockKey(),
      kid: calculateKid(createJWK({ pemKeyBase64: keySeed.key })),
    };

    const client: Client = {
      ...mockClient,
      id: generateId(),
    };

    const keychainWithDuplicateKey: ProducerKeychain = {
      ...getMockProducerKeychain(),
      keys: [key],
    };
    await addOneClient(client);
    await addOneProducerKeychain(keychainWithDuplicateKey);

    mockSelfcareV2ClientCall([mockSelfCareUsers]);

    await expect(
      authorizationService.createKey(
        {
          clientId: client.id,
          keySeed,
        },
        getMockContext({ authData: mockAuthData })
      )
    ).rejects.toThrowError(keyAlreadyExists(key.kid));
  });
  it("should throw notAnRSAKey if the key is not an RSA key", async () => {
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

    await addOneClient(mockClient);
    mockSelfcareV2ClientCall([mockSelfCareUsers]);
    await expect(
      authorizationService.createKey(
        {
          clientId: mockClient.id,
          keySeed,
        },
        getMockContext({ authData: mockAuthData })
      )
    ).rejects.toThrowError(notAnRSAKey());
  });
  it("should throw invalidPublicKey if the key is invalid", async () => {
    await addOneClient(mockClient);

    const keys = [
      // no delimiters in the key
      "Ck1JSUJDZ0tDQVFFQXF1c1hpYUtuR2RmbnZyZ21WNDlGK2lJR0lOa0tUQ0FJQTZ0d3NVUzNzaWVxdXlQRk80QmMKcVhZSUE2cXZyWDJxc21hOElTS2RMbkt5azBFNXczQ0JOZmZCcUs2ZE9pYm5xZGxEVndnZDZEWm1HY2VWWWFoYQp6QnpqbFdXcllmNEUrTUNvZ1FiUEFYTytOa0Z0M1c3cVhMTFFCYzBYTXlIelQzTlBtQlpJTktRMS9hd05iR3dYCnJJSGlyVnBqZHVpNzJRb3hjR1VBMW5JallRTW9iQ3VBMHg1L3dFL29KblFZZ1g1NVg3SnRKaTQ2dmx0VlpiVVMKckZiWkdlRUIzMEF1NUV6a0U0NUpLVGpTZnVmclJEZDJzcFByKzJiYmFibFFsY1lSYnloaHVpeVR2cU1pSGZmKwplZ2JJNGpseVFSTExhUXdEeThzOHd2NDNWNUtzNmtmVGVRSURBUUFCCgo=",
      // lower case begin and end of key
      "LS0tLS1iZWdpbiBwdWJsaWMga2V5LS0tLS0KTUlJQklqQU5CZ2txaGtpRzl3MEJBUUVGQUFPQ0FROEFNSUlCQ2dLQ0FRRUF3WUtQbDRKRW84TVFjd1JuTmlRcQp6TDhRQXVOMndkd0ZEM0dObndRTkg2S1FmTlJRNmZSTnFGUlp2RUNtTmJEMFVwWHFISnMrdVg5SzQ5YnZUcW1rCnFHWEJLa3pNdWkweTZFRjJwUzJJS2cxcUNQY2dSUHNySjRtWlZuYjNXWjk0Yktvb2U5SjlLWkE1cnYvMjd1Vm0KRGVRTU94cjlucGpoc29SN3R3bzB1Y1I1bEFqclJlRWVqbFRLS0V3TjNySU9OOHNEYlJSRWdDd1huc2hYOXVBNgo3dGdrbEMvSkJLWTZrWlVna1o2WlRrZE0zdzhUNktZdm1DaXMzVUpCR3BTSjJUTU93L0xwdWJUM0VIcFFRNythCkZrSlZkdnI0UVBXRTBwcmwxRkV4eHkyWkhZcjhndlpyS25landNRkdiVG10ZjJ3VEt6eG1XWFJOUUVFMGN3NU4KUFFJREFRQUIKLS0tLS1lbmQgcHVibGljIGtleS0tLS0t",
      // BEGIN RSA PUBLIC KEY (no SPKI format)
      "LS0tLS1CRUdJTiBSU0EgUFVCTElDIEtFWS0tLS0tCk1JSUJDZ0tDQVFFQXUxU1UxTGZWTFBIQ296TXhIMk1vNGxnT0VlUHpObTB0UmdlTGV6VjZmZkF0MGd1blZUTHcKN29uTFJucnEwL0l6Vzd5V1I3UWtybUJMN2pUS0VuNXUrcUtoYndLZkJzdElzK2JNWTJaa3AxOGduVHhLTHhvUwoydEZjekdrUExQZ2l6c2t1ZW1NZ2hSbmlXYW9MY3llaGtkM3FxR0VsdlcvVkRMNUFhV1RnMG5MVmtqUm85eis0CjBSUXp1VmFFOEFrQUZJRWtrcnFyWk15WFcwQlpzUGdDZm9ocXZZZUU5VS8xUC9SU0dRU0lQSlJlTnV4QXJmaVYKVWk0ZUpJVW1yd0hBMFFJREFRQUIKLS0tLS1FTkQgUlNBIFBVQkxJQyBLRVktLS0tLQ==",
    ];

    mockSelfcareV2ClientCall([mockSelfCareUsers]);
    keys.forEach(async (key) => {
      await expect(
        authorizationService.createKey(
          {
            clientId: mockClient.id,
            keySeed: {
              ...keySeed,
              key,
            },
          },
          getMockContext({ authData: mockAuthData })
        )
      ).rejects.toThrowError(invalidPublicKey());
    });
  });
  it("should throw notAllowedCertificateException if the key contains a certificate", async () => {
    mockSelfcareV2ClientCall([mockSelfCareUsers]);

    await addOneClient(mockClient);

    await expect(
      authorizationService.createKey(
        {
          clientId: mockClient.id,
          keySeed: {
            ...keySeed,
            key: "LS0tLS1CRUdJTiBDRVJUSUZJQ0FURS0tLS0tCk1JSUROakNDQWg2Z0F3SUJBZ0lHQVpJQXNpaThNQTBHQ1NxR1NJYjNEUUVCQ3dVQU1Gd3hEakFNQmdOVkJBTU1CVkJ5YjNaaE1Rc3dDUVlEVlFRR0V3SlZVekVPTUF3R0ExVUVDd3dGY0hKdmRtRXhEakFNQmdOVkJBY01CWEJ5YjNaaE1SMHdHd1lKS29aSWh2Y05BUWtCRmc1d2NtOTJZVUJ0WVdsc0xtTnZiVEFlRncweU5EQTVNVGN4TlRVMU1qaGFGdzB5TlRBNU1UY3hOVFUxTWpoYU1Gd3hEakFNQmdOVkJBTU1CVkJ5YjNaaE1Rc3dDUVlEVlFRR0V3SlZVekVPTUF3R0ExVUVDd3dGY0hKdmRtRXhEakFNQmdOVkJBY01CWEJ5YjNaaE1SMHdHd1lKS29aSWh2Y05BUWtCRmc1d2NtOTJZVUJ0WVdsc0xtTnZiVENDQVNJd0RRWUpLb1pJaHZjTkFRRUJCUUFEZ2dFUEFEQ0NBUW9DZ2dFQkFLR0xCZHJacmpRLzRqd2h3Y1ZhU0kvTlgyV1ozMGx3VE5wVHlhMjhXSDhEOGlHVTlZdG1CL0s3cXUxQjhaOGtGaWJtditteGh1dS8rbStGRTg4SmIwM3pnU0liT1JwY0FSaThmWGFuZzM1eG8rdmh1bE5iL2x5bWthaFZ5ekRCSER0aXl5WUlUZTdsMmNPT0hPdm5MbDhRZERpZUhjOUNmcVJYTDhVeFlNaG1wd2QyMlVOK1BsNE1SNXFhbVFFZkp4cGxLdllva1NYTUdrb1QxWEJHcitmSDBsL0ZKRmxZT3R6QUdvSm5xUkNwTDRiNlZUeGxZZlZuUXhaNnpSQkRlbTd0dDhraGJncm1Va2hIWG1YaTNuL1A2RktEQnNyNG9WbjlUU2QyUENwL1VzQmtiKzB1RktuVFlyZyt5aSt5NVBZb2NmbTZUbnl1bUVOU2VHNGZxSUVDQXdFQUFUQU5CZ2txaGtpRzl3MEJBUXNGQUFPQ0FRRUFGdDRjOUs0TWJOV0Ewb1k1RzdiWHQ1RW5FeXNLNTh0R1RSU2xpTG14aTRxSXE3eTNQMjExTUcvTDhpc211WVNybkF2Q29Yb1ZJbDZldzloOGh4eGl4N2QvR3dNc3lISzhQcm5SamZIU2pmL1ZzcGJXdTVPOEQzV1RtanNjOTVnMTZIbmgrS2NiaWFzN0FFNi95d2EvK1ZrdG55dnROL21vQzdtc2R3eForS3o1Nld0WTkzWVpBTkQwSUx2Y1pVRlNMbUdsNTI5Q2lxdlByVURlY2RFVWFob3J4VXozdWJ1ZmJjNW5PWTV6RU1FNkNWNG9SUWJzWTBmbWxoU1Q5Y20xc1ZSUmJsV1VNSTcyeGRGZFJIc04wcFpNaWYvVWpKTGhBTTQ0SUxSZXYwenRjMnlYMGtZUXBSejJmcWtucnY3S1ZRU1dwcjM4QlZSV3NJU0J5NnFZbHc9PQotLS0tLUVORCBDRVJUSUZJQ0FURS0tLS0t",
          },
        },
        getMockContext({ authData: mockAuthData })
      )
    ).rejects.toThrowError(notAllowedCertificateException());
  });
  it("should throw notAllowedMultipleKeysException if the pem contains multiple keys", async () => {
    mockSelfcareV2ClientCall([mockSelfCareUsers]);

    await addOneClient(mockClient);

    const keys = [
      // Public key and public key
      "LS0tLS1CRUdJTiBQVUJMSUMgS0VZLS0tLS0KTUlJQklqQU5CZ2txaGtpRzl3MEJBUUVGQUFPQ0FROEFNSUlCQ2dLQ0FRRUEwLzZyd3BDSnkyd3c5RFZHUUYyUwpqUjZpbzBjcUFiU1VGSjJMRDI5ZFNha000ZUg4SlBha1JONG00bHhYR0gzMlNQemtsVER1ejVkMTBFZWxDbjBHCkdhMmVFMlRxSTFyRHVSbmRXc1JwSGd4OHlhQXcvaWt3YVRIZEtCZnBXbkZ1djJSUkV5ZkFrcFJUVDZwUk51R2kKM2tQMldjdndBMkR2TTNDYVBzUDVubVZlS05tb09vZElEbUtLS0VEaFRvWVh4cVFScGd0bEJObGNQTldqalhUdApQdFpvZG0xYng0T1cwMU1EQUt3OVVBZHpBd3lMK2VNMFJMZWV4TWdUcnVGTTFqMUlCUHhJNDRRdHRCUnExN3BFClN1aGRlaWk2bFRjcStFazVnWjd4TitqSi9yY2M3akQ3N3ovYURqTEkybjVzdFdmaWJzN1FkZmdVajN2N1hINGQKQndJREFRQUIKLS0tLS1FTkQgUFVCTElDIEtFWS0tLS0tCi0tLS0tQkVHSU4gUFVCTElDIEtFWS0tLS0tCk1JSUJJakFOQmdrcWhraUc5dzBCQVFFRkFBT0NBUThBTUlJQkNnS0NBUUVBMC82cndwQ0p5Mnd3OURWR1FGMlMKalI2aW8wY3FBYlNVRkoyTEQyOWRTYWtNNGVIOEpQYWtSTjRtNGx4WEdIMzJTUHprbFREdXo1ZDEwRWVsQ24wRwpHYTJlRTJUcUkxckR1Um5kV3NScEhneDh5YUF3L2lrd2FUSGRLQmZwV25GdXYyUlJFeWZBa3BSVFQ2cFJOdUdpCjNrUDJXY3Z3QTJEdk0zQ2FQc1A1bm1WZUtObW9Pb2RJRG1LS0tFRGhUb1lYeHFRUnBndGxCTmxjUE5XampYVHQKUHRab2RtMWJ4NE9XMDFNREFLdzlVQWR6QXd5TCtlTTBSTGVleE1nVHJ1Rk0xajFJQlB4STQ0UXR0QlJxMTdwRQpTdWhkZWlpNmxUY3ErRWs1Z1o3eE4rakovcmNjN2pENzd6L2FEakxJMm41c3RXZmliczdRZGZnVWozdjdYSDRkCkJ3SURBUUFCCi0tLS0tRU5EIFBVQkxJQyBLRVktLS0tLQ==",
      // Private key and public key
      "LS0tLS1CRUdJTiBQUklWQVRFIEtFWS0tLS0tCk1JSUV2UUlCQURBTkJna3Foa2lHOXcwQkFRRUZBQVNDQktjd2dnU2pBZ0VBQW9JQkFRQzVpTWpIeVlSV096WHkKTmxHS1VZWDd6VkIvYUlWc1Z3WkFBMnFZSFp3U0dYaFJFVmxMOEVWR1VaU3VFNVRyVjVNdDRoQXdFS2tNa1kzaApOL0hNaXFNb0FoVGx6VVFqZDR6RVFCZ05GclB5NThlUDI1TnJZRkF3L2NDNEFpTjFQZlBSTlpWUERwTTJBcUx0CmYrelZacDhIUzNxWUo4NHJYWVpnU2FCVzdacGd3Z1I3aS84UWFVWE1kWE83cUsyRWM5QnFVY05GWkk4anljOEwKR3JLWG1nYlQrNXd2dEpjSVpyV2daOGtaY1Y3QmZ1Q0tZaUtLbzlTS0tuWWdqNFhENGp2T211Y0tyVVYzVGRWWApLZDhWRFZieGRWYjBvK1hqVldYT0pyd2d4SjdLQ1ZIN2REUUdxdzZ5QkhOaEp4L1A2UU50ZkhLUU9nbS9Rc0VMCjVFOXJyakFsQWdNQkFBRUNnZ0VBU1RkVXY1MmFxV3Qvcmw0UWQycDhZaDc2UWduNGNBdUUzaVNOOUpVSFFVaW4KVUpoTUprSVFuZ3lMSkdpSllHZmN4QSt3Zy9pTFZmQTl0TUZMQ3lWaFhabENtUFRLeSt0NUdJNldxN2ZKTUdqMAp4VVNDZEQwSjZxRmdFSUVmVXZmaFhJN2NDVDhxNlFqODArNEdIWHVvRXFZWmRLbFV5S0x5SGxHUGFXa0NienczCjhmdUJwUHUxSFhzQVc0TUlrZFpZWVA2SGRLb0tBZjFYZGtBRHFRU3ZLbUlnUUNUMnVJOWtjcjBBb05KOVcyQkwKUzVEeHcyUU9LampKWDFuL1hKUlJoU1BPV2NZVmRObktKMEVoN2M2bWtaSFFJeEU5VlZoZ1dXT0pVTVdCYzBVZQpXNVBYRUxtaERxbTFZalBXdStYbTNvaWRWQ1BnV3ZVeEgzejBwUkxnQVFLQmdRRGdrTExsTTlZWkk4UmFJVTVLCk1oeDhZYk5RZExuUlpzT1o5eUZIY1NtL1Y0WkFJc0ZqaERKazd1R1FtSCtDSWZuekRud2t3Q1dRRTRRSHV3OXgKWWVYS2lYbmJWUFFwRS9vNTFMQ0dYMHp2TWk2akNFSTJRVG5YY3B2WVJ2emlIMnNVUU84dEVvM282VW1MWTlTawp2S1hyV0dYeDN3RmRYd2NVMUtYUFh3ZkVwUUtCZ1FEVEt4Z3daYlR4NjVXT0NxTGlLS2VBSGFGdnFESmlrZ0pMCjlxS3RXMWlld2ZPNUtaN0Z5MmZCbVhtSFRNMWNMaDF1Q2krL0ZxRDJuQ3VNSUtncVRXZ0JlNklHUEdXQkdaNHkKSkJCNElSV0N4ZnlvUzJwSEZrdUxESEc0YUpGS0N4TXQ4ZW9pRzd0ejBCdmtjK2k5MGZIeEhBbTFaOUg5c094MQpFeXVKeEpiMkFRS0JnUUM1RkdaSlYzZkdjU0pQWjB2U3RiR0NyczRLdnh2a1RPVktaVktneDV0MnYwb29GTTZoCnhKbHdYSzFKUFZORm5qU05BWmcxUjJkUlhVbzRZTlNTVzhaNUtnUFJGenJaR1VZRUNGRC83ZEp1WXlxQlRseloKUVoxcXYwcGoxVVNWczIvVDg0Unk1OUQwUm5yV2w3VkNKd1Y5UVR2YmdaSmVCNWg0ckk2S2lMNUJUUUtCZ0NpSgptSUZUL2VPSWJKRnl2MjBYOXFBQnRINkU5TEc5UkNMallpM3NJSUJKek1uTlpqK0NxRldLdllIWjd2S3VxeC84CjlCOU9QMy9MUURtUHJxNk9lM0VraVpKOWdEdkIwVXdtV3hJR3dsQkxYckloSVl1NURvQnVKNUVMQ1l1R2JLTjQKNlZiMlBKYlg4U0tRaEVWNlAxTmVScHpaQ3B2YnYxRExlL1lESVJNQkFvR0FjdGpSa1ZKN2JTS1hlL0E1cEc0Qwp0UExrcDZPVFJUN0FPbEQ0eFM4RDRqRUtxOENwQUtaRm9xTFlWdHpuMGw5LzBlWWtBR0p4RkR2cEV4RnRNSnpNClpyS01Eb2tBTFVMbmtPOWxNeERWcVBQMU9WeVl2Qk5nTi84RlpBYzIxUmw5L2g4SWtJdDRpWVFBMGNqYkhXVnMKc05RUVFuVXhMOTJSUUFUVnhHVEtSSnc9Ci0tLS0tRU5EIFBSSVZBVEUgS0VZLS0tLS0KLS0tLS1CRUdJTiBQVUJMSUMgS0VZLS0tLS0KTUlJQklqQU5CZ2txaGtpRzl3MEJBUUVGQUFPQ0FROEFNSUlCQ2dLQ0FRRUF1WWpJeDhtRVZqczE4alpSaWxHRgorODFRZjJpRmJGY0dRQU5xbUIyY0VobDRVUkZaU3ZCRlJsR1VyaE9VNjFlVExlSVFNQkNwREpHTjRUZnh6SXFqCktBSVU1YzFFSTNlTXhFQVlEUmF6OHVmSGo5dVRhMkJRTVAzQXVBSWpkVDN6MFRXVlQgdzZUTmdLaTdYL3MxV2FmCkIwdDZtQ2ZPSzEyR1lFbWdWdTJhWU1JRWU0di9FR2xGekhWenU2aXRoSFBRYWxIRFJXU1BJOG5QQ3hxeWw1b0cKMC91Y0w3U1hDR2Exb0dmSkdYRmV3WDdnaW1JaWlxUFVpaXAySUkrRncrSTd6cHJuQ3ExRmQwM1ZWeW5mRlExVwo4WFZXOUtQbDQxVmx6aWFzSU1TZXlnbFIrM1EwQnFzT3NnUnpZU2NmeitrRGJYeHlrRG9KdjBMQkMrUlBhNjR3CkpRSURBUUFCCi0tLS0tRU5EIFBVQkxJQyBLRVktLS0tLQ==",
      // Public key and private key
      "LS0tLS1CRUdJTiBQVUJMSUMgS0VZLS0tLS0KTUlJQklqQU5CZ2txaGtpRzl3MEJBUUVGQUFPQ0FROEFNSUlCQ2dLQ0FRRUFyaVM2elVMWUtKMUJydEZLczBwVwowQzZhZ1BSdU9qSCt2Mk11N0Y4cUlIQk5NNmNFb0MvMkxLR3drUEd2ajcvdllyTFFrWHJJSGFSUHh0NXpIdVRiCnAxcVJRS05tVFRaOFk1WUNFOHYrVEYzWEMrZkc1RTNCQ3JnQXdXRE1wZUZYS1dSa2xuM0ZSbjZyMGZTZmd4cnAKTy9DZXFDVGFRTVhLRCtTVHA1ZklvQTdqWGpibTRTUmdQK1dDakdHajhEU0I1YlBESndJVFFiS0gxYklHNHBOZwpXQk5oQ1VRQTJLUWFkSERIYTQvT1MzSk92V25KRXd6NUhRbkZpTlNOQ25UWENIa2NXZ0t6Q09WUkdZNFRadG0wCis1enhLazhKVmNtcXk1ellhZExoUFpxT04vMkpKNFZqRlhzY2t4ZEpSVEVnWHBaWHlMdUVwTlNzNEh2SitRVm0KWFFJREFRQUIKLS0tLS1FTkQgUFVCTElDIEtFWS0tLS0tCi0tLS0tQkVHSU4gUFJJVkFURSBLRVktLS0tLQpNSUlFdlFJQkFEQU5CZ2txaGtpRzl3MEJBUUVGQUFTQ0JLY3dnZ1NqQWdFQUFvSUJBUUN1SkxyTlF0Z29uVUd1CjBVcXpTbGJRTHBxQTlHNDZNZjYvWXk3c1h5b2djRTB6cHdTZ0wvWXNvYkNROGErUHYrOWlzdENSZXNnZHBFL0cKM25NZTVOdW5XcEZBbzJaTk5ueGpsZ0lUeS81TVhkY0w1OGJrVGNFS3VBREJZTXlsNFZjcFpHU1dmY1ZHZnF2Ugo5SitER3VrNzhKNm9KTnBBeGNvUDVKT25sOGlnRHVOZU51YmhKR0EvNVlLTVlhUHdOSUhsczhNbkFoTkJzb2ZWCnNnYmlrMkJZRTJFSlJBRFlwQnAwY01kcmo4NUxjazY5YWNrVERQa2RDY1dJMUkwS2ROY0llUnhhQXJNSTVWRVoKamhObTJiVDduUEVxVHdsVnlhckxuTmhwMHVFOW1vNDMvWWtuaFdNVmV4eVRGMGxGTVNCZWxsZgpJdTRTazFLemdlOG41QldaZEFnTUJBQUVDZ2dFQUhHU1paRHZsd1FOMVp3R25rWERSWXlQOHZ3TDNUWk1zS1FJMgpCWkcwa1VoQ2pFWGpwMVM3SzZXVEtPUVpkSmp6S0pTcVdxWVVpT1ppU05aRTRRTjdVWXhuSEpGWDJZUXpYV3d2Cm1VY1hNd3huUlV2T1ZTcUVXZzB5NE5IV3hlM2IzdHpnRlUxbVBKQ3JGTlBEOHJ1QlpxeUJjVHhDZlhGSEo0V0QKdkxoWlhMMkJMbUJHeERYSGxGY3FtL1pSd1B3cVlKNnZIVVpNUTRPSUVxWXMzQStiWmhzTjl4V1I1L0U3dGVEWQpiV0Y0ekx4Vlp0VlR6TzVuRHBCd09iQ1hzcUVWQms3OVhSaGlJYVdPVlZFTkVRRHNLV2dDRGpnRlQzRjQrc1QyCnhJeEl1VUJaY0FCNExMZ0RYdDVjOEgzZFVZL0xwVVd4VlhGSlBFK3A4UUtCZ1FEMFdKSHdiVDdwV3FGZHdCbUwKUVRhVk5OaHVqZnpwWjRwRk1EdUFZL3UxRWlIOEo2Z0VuOGZ3UUtoSVZiUlo1RGRYaE16RVgzU1lmVGtWcGdSNgpEbFc2SVpFRVJNZ056MFFPNGdLSGN1Um5GYkp0V2tMUmNUN2g4aUdYQ0laeU5NUWlWbk5rTEZkaWJLWS9MKzVTCm05L0pFM3A0Slc4dkVLbHdEYVpaR3EvbjF3S0JnUUMycVovS1BBVW9BMXdKYlRwUmRWN3BTL3BUaStOM2RHRTkKWk8rbUd4K1VrQk1YVWRKbFVhWTkrVlJVVWhXOHR4RnhiR3BPRUNNbnBVT1hRclBxUHRLV0o1VUw1VzVaUzhTdwpwbkJMK1R6QmRGd200WGczaG1ESkRWblBKUUV6cUNHL05TRFZ5cVFOTlpNaUptb0d4Q3ZRRDBhNXVTVnZqVUJ4ClBnV3dYTFVMaXdLQmdRREVGcXlKcVliUzdqQk9Ra0Z3SEJaKytVQnc3RGhQUGpEQzhRNkhoWDROUkdsd1BMVVkKWlVNbFZHNndFZlRFQlV4UkNQTlVjU2M3cTNsVHNpRlNvSEx0L3FVd1pIL2tLVVpHam9RaDBwUzVPL3RGZ0loUwpHS0RrZ2ZNQWw1SEJ2R3RXWlhiaGlFN3EwR1VnTE5XR3BWNVNCcklvTTNGK0RRaE0vRmlRK0c5bEF3S0JnQ2tiCkRRMVZUVWFVOGNPQUZac1pLQTJ1UkhGd3F5WE40RTF4MnkvT1k3VkhrMHhDSFFBTEVJcC9Yb1M5ZUtuWk5WR1cKVkx6S3JXR0tHSEZYS1VkT0p0bTRFZVpJSmtyWUM0SGRIUEtJdUhoTGFaNzV1M3hXc0YxM0VYamR6QVE2dXFBbwpVdkdrazFKaFk4Z0pMaFd6Sk9RTnRhckRTYUFjbFFrSlpXbnBuSkk5QW9HQVcrMnFIakkyM1hGUE1nQnh2NmMvCmlaYVdid3dFT1JiNjJ2Zlo0c1hLNXJCYkpnWEIwUFZUVklaU1VDbTRDVU9iM1o4RldBeGJWa0R6TXd3KzVaUFgKdHpxd21YaEorVWNMSVFsa0xGUHg0U0lUelZHUFFaQnZSeG1Wc002TWxSVVdCTEFHTUk1WjdZVGovWnVSTG5ZdgpFN2JabCtaZlJ1R1BSVi9YNStRaExMaz0KLS0tLS1FTkQgUFJJVkFURSBLRVktLS0tLQ==",
    ];

    keys.forEach(async (key) => {
      await expect(
        authorizationService.createKey(
          {
            clientId: mockClient.id,
            keySeed: {
              ...keySeed,
              key,
            },
          },
          getMockContext({ authData: mockAuthData })
        )
      ).rejects.toThrowError(notAllowedMultipleKeysException());
    });
  });

  it("should throw invalidKeyLength if the key doesn't have 2048 bites", async () => {
    const key = crypto.generateKeyPairSync("rsa", {
      modulusLength: 1024,
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

    await addOneClient(mockClient);
    mockSelfcareV2ClientCall([mockSelfCareUsers]);
    await expect(
      authorizationService.createKey(
        {
          clientId: mockClient.id,
          keySeed,
        },
        getMockContext({ authData: mockAuthData })
      )
    ).rejects.toThrowError(invalidKeyLength(1024, 2048));
  });
});
