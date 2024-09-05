import crypto from "crypto";
import {
  getMockKey,
  getMockProducerKeychain,
} from "pagopa-interop-commons-test/index.js";
import {
  AuthorizationEventEnvelopeV2,
  generateId,
  ProducerKeychainId,
  ProducerKeychain,
  ProducerKeychainKeyAddedV2,
  toProducerKeychainV2,
} from "pagopa-interop-models";
import { describe, it } from "vitest";
import { handleMessageV2 } from "../src/producerKeyConsumerServiceV2.js";
import { getLastEventByKid, postgresDB } from "./utils.js";

describe("Events V2", () => {
  const key = crypto.generateKeyPairSync("rsa", {
    modulusLength: 2048,
  }).publicKey;

  const base64Key = Buffer.from(
    key.export({ type: "pkcs1", format: "pem" })
  ).toString("base64url");

  it("ProducerKeychainKeyAdded", async () => {
    const producerKeychainId: ProducerKeychainId = generateId();
    const mockKey = {
      ...getMockKey(),
      producerKeychainId,
      encodedPem: base64Key,
    };

    const mockProducerKeychain: ProducerKeychain = {
      ...getMockProducerKeychain(),
      id: producerKeychainId,
      keys: [mockKey],
    };

    const payload: ProducerKeychainKeyAddedV2 = {
      producerKeychain: toProducerKeychainV2(mockProducerKeychain),
      kid: mockKey.kid,
    };

    const message: AuthorizationEventEnvelopeV2 = {
      sequence_num: 1,
      stream_id: mockProducerKeychain.id,
      version: 1,
      type: "ProducerKeychainKeyAdded",
      event_version: 2,
      data: payload,
      log_date: new Date(),
    };

    await handleMessageV2(message, postgresDB);

    const retrievedKey = await getLastEventByKid(mockKey.kid);
    console.log(retrievedKey);
  });
  // it("ProducerKeychainKeyDeleted", async () => {
  //   const producerKeychainId: ProducerKeychainId = generateId();
  //   const mockKey: Key = {
  //     ...getMockKey(),
  //     encodedPem: base64Key,
  //   };
  //   const producerKeychainJWKKey = keyToProducerJWKKey(
  //     mockKey,
  //     producerKeychainId
  //   );
  //   const mockProducerKeychain: ProducerKeychain = {
  //     ...getMockProducerKeychain(),
  //     id: producerKeychainId,
  //     keys: [mockKey],
  //   };
  //   await writeInReadmodel(producerKeychainJWKKey, producerKeys);

  //   const updatedProducerKeychain = {
  //     ...mockProducerKeychain,
  //     producerKeys: [],
  //   };

  //   const payload: ProducerKeychainKeyDeletedV2 = {
  //     producerKeychain: toProducerKeychainV2(updatedProducerKeychain),
  //     kid: mockKey.kid,
  //   };

  //   const message: AuthorizationEventEnvelopeV2 = {
  //     sequence_num: 1,
  //     stream_id: mockProducerKeychain.id,
  //     version: 1,
  //     type: "ProducerKeychainKeyDeleted",
  //     event_version: 2,
  //     data: payload,
  //     log_date: new Date(),
  //   };

  //   await handleMessageV2(message, producerKeys);

  //   const retrievedKey = await producerKeys.findOne({
  //     "data.kid": mockKey.kid,
  //   });

  //   expect(retrievedKey).toBeNull();
  // });
});
