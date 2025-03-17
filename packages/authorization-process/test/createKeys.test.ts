/* eslint-disable functional/no-let */
/* eslint-disable @typescript-eslint/no-floating-promises */
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
  invalidKey,
  notAllowedCertificateException,
  notAllowedMultipleKeysException,
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
  getMockProducerKeychain,
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
  addOneProducerKeychain,
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
  it("should throw keyAlreadyExists if the kid already exists in a keychain", async () => {
    const key: Key = {
      ...getMockKey(),
      kid: calculateKid(createJWK(keySeed.key)),
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
    await addOneClient(mockClient);

    const keys = [
      "Ck1JSUJDZ0tDQVFFQXF1c1hpYUtuR2RmbnZyZ21WNDlGK2lJR0lOa0tUQ0FJQTZ0d3NVUzNzaWVxdXlQRk80QmMKcVhZSUE2cXZyWDJxc21hOElTS2RMbkt5azBFNXczQ0JOZmZCcUs2ZE9pYm5xZGxEVndnZDZEWm1HY2VWWWFoYQp6QnpqbFdXcllmNEUrTUNvZ1FiUEFYTytOa0Z0M1c3cVhMTFFCYzBYTXlIelQzTlBtQlpJTktRMS9hd05iR3dYCnJJSGlyVnBqZHVpNzJRb3hjR1VBMW5JallRTW9iQ3VBMHg1L3dFL29KblFZZ1g1NVg3SnRKaTQ2dmx0VlpiVVMKckZiWkdlRUIzMEF1NUV6a0U0NUpLVGpTZnVmclJEZDJzcFByKzJiYmFibFFsY1lSYnloaHVpeVR2cU1pSGZmKwplZ2JJNGpseVFSTExhUXdEeThzOHd2NDNWNUtzNmtmVGVRSURBUUFCCgo=", // no delimiters in the key
      "LS0tLS1iZWdpbiBwdWJsaWMga2V5LS0tLS0KTUlJQklqQU5CZ2txaGtpRzl3MEJBUUVGQUFPQ0FROEFNSUlCQ2dLQ0FRRUF3WUtQbDRKRW84TVFjd1JuTmlRcQp6TDhRQXVOMndkd0ZEM0dObndRTkg2S1FmTlJRNmZSTnFGUlp2RUNtTmJEMFVwWHFISnMrdVg5SzQ5YnZUcW1rCnFHWEJLa3pNdWkweTZFRjJwUzJJS2cxcUNQY2dSUHNySjRtWlZuYjNXWjk0Yktvb2U5SjlLWkE1cnYvMjd1Vm0KRGVRTU94cjlucGpoc29SN3R3bzB1Y1I1bEFqclJlRWVqbFRLS0V3TjNySU9OOHNEYlJSRWdDd1huc2hYOXVBNgo3dGdrbEMvSkJLWTZrWlVna1o2WlRrZE0zdzhUNktZdm1DaXMzVUpCR3BTSjJUTU93L0xwdWJUM0VIcFFRNythCkZrSlZkdnI0UVBXRTBwcmwxRkV4eHkyWkhZcjhndlpyS25landNRkdiVG10ZjJ3VEt6eG1XWFJOUUVFMGN3NU4KUFFJREFRQUIKLS0tLS1lbmQgcHVibGljIGtleS0tLS0t", // lower case begin and end of key
      "LS0tLS1CRUdJTiBSU0EgUFVCTElDIEtFWS0tLS0tCk1JSUJDZ0tDQVFFQXUxU1UxTGZWTFBIQ296TXhIMk1vNGxnT0VlUHpObTB0UmdlTGV6VjZmZkF0MGd1blZUTHcKN29uTFJucnEwL0l6Vzd5V1I3UWtybUJMN2pUS0VuNXUrcUtoYndLZkJzdElzK2JNWTJaa3AxOGduVHhLTHhvUwoydEZjekdrUExQZ2l6c2t1ZW1NZ2hSbmlXYW9MY3llaGtkM3FxR0VsdlcvVkRMNUFhV1RnMG5MVmtqUm85eis0CjBSUXp1VmFFOEFrQUZJRWtrcnFyWk15WFcwQlpzUGdDZm9ocXZZZUU5VS8xUC9SU0dRU0lQSlJlTnV4QXJmaVYKVWk0ZUpJVW1yd0hBMFFJREFRQUIKLS0tLS1FTkQgUlNBIFBVQkxJQyBLRVktLS0tLQ==", // BEGIN RSA PUBLIC KEY (no SPKI format)
    ];

    mockSelfcareV2ClientCall([mockSelfCareUsers]);
    keys.forEach((key) => {
      expect(
        authorizationService.createKeys({
          clientId: mockClient.id,
          authData: mockAuthData,
          keysSeeds: [
            {
              ...keySeed,
              key,
            },
          ],
          correlationId: generateId(),
          logger: genericLogger,
        })
      ).rejects.toThrowError(
        invalidKey(key, "error:1E08010C:DECODER routines::unsupported")
      );
    });
  });
  it("should throw notAllowedCertificateException if the key contains a certificate", async () => {
    mockSelfcareV2ClientCall([mockSelfCareUsers]);

    await addOneClient(mockClient);

    const cert =
      "LS0tLS1CRUdJTiBDRVJUSUZJQ0FURS0tLS0tCk1JSUROakNDQWg2Z0F3SUJBZ0lHQVpJQXNpaThNQTBHQ1NxR1NJYjNEUUVCQ3dVQU1Gd3hEakFNQmdOVkJBTU1CVkJ5YjNaaE1Rc3dDUVlEVlFRR0V3SlZVekVPTUF3R0ExVUVDd3dGY0hKdmRtRXhEakFNQmdOVkJBY01CWEJ5YjNaaE1SMHdHd1lKS29aSWh2Y05BUWtCRmc1d2NtOTJZVUJ0WVdsc0xtTnZiVEFlRncweU5EQTVNVGN4TlRVMU1qaGFGdzB5TlRBNU1UY3hOVFUxTWpoYU1Gd3hEakFNQmdOVkJBTU1CVkJ5YjNaaE1Rc3dDUVlEVlFRR0V3SlZVekVPTUF3R0ExVUVDd3dGY0hKdmRtRXhEakFNQmdOVkJBY01CWEJ5YjNaaE1SMHdHd1lKS29aSWh2Y05BUWtCRmc1d2NtOTJZVUJ0WVdsc0xtTnZiVENDQVNJd0RRWUpLb1pJaHZjTkFRRUJCUUFEZ2dFUEFEQ0NBUW9DZ2dFQkFLR0xCZHJacmpRLzRqd2h3Y1ZhU0kvTlgyV1ozMGx3VE5wVHlhMjhXSDhEOGlHVTlZdG1CL0s3cXUxQjhaOGtGaWJtditteGh1dS8rbStGRTg4SmIwM3pnU0liT1JwY0FSaThmWGFuZzM1eG8rdmh1bE5iL2x5bWthaFZ5ekRCSER0aXl5WUlUZTdsMmNPT0hPdm5MbDhRZERpZUhjOUNmcVJYTDhVeFlNaG1wd2QyMlVOK1BsNE1SNXFhbVFFZkp4cGxLdllva1NYTUdrb1QxWEJHcitmSDBsL0ZKRmxZT3R6QUdvSm5xUkNwTDRiNlZUeGxZZlZuUXhaNnpSQkRlbTd0dDhraGJncm1Va2hIWG1YaTNuL1A2RktEQnNyNG9WbjlUU2QyUENwL1VzQmtiKzB1RktuVFlyZyt5aSt5NVBZb2NmbTZUbnl1bUVOU2VHNGZxSUVDQXdFQUFUQU5CZ2txaGtpRzl3MEJBUXNGQUFPQ0FRRUFGdDRjOUs0TWJOV0Ewb1k1RzdiWHQ1RW5FeXNLNTh0R1RSU2xpTG14aTRxSXE3eTNQMjExTUcvTDhpc211WVNybkF2Q29Yb1ZJbDZldzloOGh4eGl4N2QvR3dNc3lISzhQcm5SamZIU2pmL1ZzcGJXdTVPOEQzV1RtanNjOTVnMTZIbmgrS2NiaWFzN0FFNi95d2EvK1ZrdG55dnROL21vQzdtc2R3eForS3o1Nld0WTkzWVpBTkQwSUx2Y1pVRlNMbUdsNTI5Q2lxdlByVURlY2RFVWFob3J4VXozdWJ1ZmJjNW5PWTV6RU1FNkNWNG9SUWJzWTBmbWxoU1Q5Y20xc1ZSUmJsV1VNSTcyeGRGZFJIc04wcFpNaWYvVWpKTGhBTTQ0SUxSZXYwenRjMnlYMGtZUXBSejJmcWtucnY3S1ZRU1dwcjM4QlZSV3NJU0J5NnFZbHc9PQotLS0tLUVORCBDRVJUSUZJQ0FURS0tLS0t";

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
  it("should throw notAllowedMultipleKeysException if the pem contains multiple keys", async () => {
    mockSelfcareV2ClientCall([mockSelfCareUsers]);

    await addOneClient(mockClient);

    const key =
      "LS0tLS1CRUdJTiBQVUJMSUMgS0VZLS0tLS0KTUlJQklqQU5CZ2txaGtpRzl3MEJBUUVGQUFPQ0FROEFNSUlCQ2dLQ0FRRUEwLzZyd3BDSnkyd3c5RFZHUUYyUwpqUjZpbzBjcUFiU1VGSjJMRDI5ZFNha000ZUg4SlBha1JONG00bHhYR0gzMlNQemtsVER1ejVkMTBFZWxDbjBHCkdhMmVFMlRxSTFyRHVSbmRXc1JwSGd4OHlhQXcvaWt3YVRIZEtCZnBXbkZ1djJSUkV5ZkFrcFJUVDZwUk51R2kKM2tQMldjdndBMkR2TTNDYVBzUDVubVZlS05tb09vZElEbUtLS0VEaFRvWVh4cVFScGd0bEJObGNQTldqalhUdApQdFpvZG0xYng0T1cwMU1EQUt3OVVBZHpBd3lMK2VNMFJMZWV4TWdUcnVGTTFqMUlCUHhJNDRRdHRCUnExN3BFClN1aGRlaWk2bFRjcStFazVnWjd4TitqSi9yY2M3akQ3N3ovYURqTEkybjVzdFdmaWJzN1FkZmdVajN2N1hINGQKQndJREFRQUIKLS0tLS1FTkQgUFVCTElDIEtFWS0tLS0tCi0tLS0tQkVHSU4gUFVCTElDIEtFWS0tLS0tCk1JSUJJakFOQmdrcWhraUc5dzBCQVFFRkFBT0NBUThBTUlJQkNnS0NBUUVBMC82cndwQ0p5Mnd3OURWR1FGMlMKalI2aW8wY3FBYlNVRkoyTEQyOWRTYWtNNGVIOEpQYWtSTjRtNGx4WEdIMzJTUHprbFREdXo1ZDEwRWVsQ24wRwpHYTJlRTJUcUkxckR1Um5kV3NScEhneDh5YUF3L2lrd2FUSGRLQmZwV25GdXYyUlJFeWZBa3BSVFQ2cFJOdUdpCjNrUDJXY3Z3QTJEdk0zQ2FQc1A1bm1WZUtObW9Pb2RJRG1LS0tFRGhUb1lYeHFRUnBndGxCTmxjUE5XampYVHQKUHRab2RtMWJ4NE9XMDFNREFLdzlVQWR6QXd5TCtlTTBSTGVleE1nVHJ1Rk0xajFJQlB4STQ0UXR0QlJxMTdwRQpTdWhkZWlpNmxUY3ErRWs1Z1o3eE4rakovcmNjN2pENzd6L2FEakxJMm41c3RXZmliczdRZGZnVWozdjdYSDRkCkJ3SURBUUFCCi0tLS0tRU5EIFBVQkxJQyBLRVktLS0tLQ==";

    expect(
      authorizationService.createKeys({
        clientId: mockClient.id,
        authData: mockAuthData,
        keysSeeds: [
          {
            ...keySeed,
            key,
          },
        ],
        correlationId: generateId(),
        logger: genericLogger,
      })
    ).rejects.toThrowError(notAllowedMultipleKeysException());
  });
});
