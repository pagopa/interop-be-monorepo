/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-floating-promises */
import crypto, { JsonWebKey } from "crypto";
import { createJWK } from "pagopa-interop-commons";
import { Client } from "pagopa-interop-models";
import { describe, it, expect } from "vitest";
import {
  getMockClient,
  getMockContext,
  getMockKey,
  sortClient,
} from "pagopa-interop-commons-test";
import {
  clientNotFound,
  clientKeyNotFound,
} from "../../src/model/domain/errors.js";
import { addOneClient, authorizationService } from "../integrationUtils.js";

describe("getKeyWithClientByKeyId", async () => {
  it("should get the jwkKey with client by kid if it exists", async () => {
    const key = crypto.generateKeyPairSync("rsa", {
      modulusLength: 2048,
    }).publicKey;

    const base64Key = Buffer.from(
      key.export({ type: "pkcs1", format: "pem" })
    ).toString("base64url");

    const mockKey1 = { ...getMockKey(), encodedPem: base64Key };

    const jwk: JsonWebKey = createJWK({ pemKeyBase64: base64Key });

    const mockKey2 = getMockKey();
    const mockClient: Client = {
      ...getMockClient(),
      keys: [mockKey1, mockKey2],
    };

    await addOneClient(mockClient);

    const result = await authorizationService.getKeyWithClientByKeyId(
      {
        clientId: mockClient.id,
        kid: mockKey1.kid,
      },
      getMockContext({})
    );

    const expectedResult = {
      client: sortClient(mockClient),
      jwk,
      kid: mockKey1.kid,
    };
    expect({
      ...result,
      client: sortClient(result.client),
    } satisfies typeof result).toEqual(expectedResult);
  });

  it("should throw clientNotFound if the client doesn't exist", async () => {
    const mockKey = getMockKey();
    const mockClient: Client = {
      ...getMockClient(),
    };

    expect(
      authorizationService.getKeyWithClientByKeyId(
        {
          clientId: mockClient.id,
          kid: mockKey.kid,
        },
        getMockContext({})
      )
    ).rejects.toThrowError(clientNotFound(mockClient.id));
  });
  it("should throw clientKeyNotFound if the key doesn't exist", async () => {
    const mockKey = getMockKey();
    const mockClient: Client = {
      ...getMockClient(),
      keys: [getMockKey()],
    };
    await addOneClient(mockClient);

    expect(
      authorizationService.getKeyWithClientByKeyId(
        {
          clientId: mockClient.id,
          kid: mockKey.kid,
        },
        getMockContext({})
      )
    ).rejects.toThrowError(clientKeyNotFound(mockKey.kid, mockClient.id));
  });
});
