/* eslint-disable @typescript-eslint/no-floating-promises */
import crypto, { JsonWebKey } from "crypto";
import {
  createJWK,
  decodeBase64ToPem,
  genericLogger,
} from "pagopa-interop-commons";
import { Client } from "pagopa-interop-models";
import { describe, it, expect } from "vitest";
import { getMockClient, getMockKey } from "pagopa-interop-commons-test";
import { ApiJWKKey } from "../src/model/domain/models.js";
import {
  clientNotFound,
  keyNotFound,
  unknownKeyType,
} from "../src/model/domain/errors.js";
import { addOneClient, authorizationService } from "./utils.js";

describe("getKeyWithClientByKeyId", async () => {
  it("should get the jwkKey with client by kid if it exists", async () => {
    const key = crypto.generateKeyPairSync("rsa", {
      modulusLength: 2048,
    }).publicKey;

    const pemKey = Buffer.from(
      key.export({ type: "pkcs1", format: "pem" })
    ).toString("base64url");

    const mockKey1 = { ...getMockKey(), encodedPem: pemKey };

    const jwk: JsonWebKey = createJWK(decodeBase64ToPem(pemKey));

    const JwkKey: ApiJWKKey = {
      ...jwk,
      kty: jwk.kty!,
      keyOps: [],
      use: mockKey1.use,
      alg: mockKey1.algorithm,
      kid: mockKey1.kid,
      x5u: "",
      x5t: "",
      x5tS256: [],
      x5c: [],
      oth: [],
    };
    const mockKey2 = getMockKey();
    const mockClient: Client = {
      ...getMockClient(),
      keys: [mockKey1, mockKey2],
    };
    await addOneClient(mockClient);

    const { JWKKey, client } =
      await authorizationService.getKeyWithClientByKeyId({
        clientId: mockClient.id,
        kid: mockKey1.kid,
        logger: genericLogger,
      });
    expect(JWKKey).toEqual(JwkKey);
    expect(client).toEqual(mockClient);
  });

  it("should throw clientNotFound if the client doesn't exist", async () => {
    const mockKey = getMockKey();
    const mockClient: Client = {
      ...getMockClient(),
    };

    expect(
      authorizationService.getKeyWithClientByKeyId({
        clientId: mockClient.id,
        kid: mockKey.kid,
        logger: genericLogger,
      })
    ).rejects.toThrowError(clientNotFound(mockClient.id));
  });
  it("should throw keyNotFound if the key doesn't exist", async () => {
    const mockKey = getMockKey();
    const mockClient: Client = {
      ...getMockClient(),
      keys: [getMockKey()],
    };
    await addOneClient(mockClient);

    expect(
      authorizationService.getKeyWithClientByKeyId({
        clientId: mockClient.id,
        kid: mockKey.kid,
        logger: genericLogger,
      })
    ).rejects.toThrowError(keyNotFound(mockKey.kid, mockClient.id));
  });
  it("should throw unknownKeyType if the kty doesn't exist or is not RSA", async () => {
    const key = crypto.generateKeyPairSync("x448", {
      modulusLength: 2048,
    }).publicKey;

    const pemKey = Buffer.from(
      key.export({ type: "spki", format: "pem" })
    ).toString("base64url");

    const jwk: JsonWebKey = createJWK(decodeBase64ToPem(pemKey));

    const mockKey1 = { ...getMockKey(), encodedPem: pemKey };
    const mockClient: Client = {
      ...getMockClient(),
      keys: [mockKey1],
    };
    await addOneClient(mockClient);

    expect(
      authorizationService.getKeyWithClientByKeyId({
        clientId: mockClient.id,
        kid: mockKey1.kid,
        logger: genericLogger,
      })
    ).rejects.toThrowError(unknownKeyType(jwk.kty!));
  });
});
