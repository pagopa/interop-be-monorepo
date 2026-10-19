import {
  EServiceId,
  generateId,
  makeProducerKeychainPlatformStatesPK,
  ProducerKeychainId,
} from "pagopa-interop-models";
import { describe, expect, it } from "vitest";

describe("keys test", () => {
  it("makeProducerKeychainPlatformStatesPK", () => {
    const producerKeychainId = generateId<ProducerKeychainId>();
    const eServiceId = generateId<EServiceId>();
    const kid = `kid-${Math.random()}`;

    const pk = makeProducerKeychainPlatformStatesPK({
      producerKeychainId,
      kid,
      eServiceId,
    });

    expect(pk).toBe(
      `PRODUCERKEYCHAINKIDESERVICE#${producerKeychainId}#${kid}#${eServiceId}`
    );
  });
});
