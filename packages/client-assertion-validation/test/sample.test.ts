import { describe, it } from "vitest";
import { clientKind, generateId } from "pagopa-interop-models";
import { ConsumerKey, Key, ApiKey } from ".././src/types.js";

describe("test", () => {
  it("zod inheritance", () => {
    const key: Key = {
      clientId: generateId(),
      consumerId: generateId(),
      kidWithPurposeId: "123",
      publicKey: "123",
      algorithm: "RS256",
    };

    const cKey: ConsumerKey = {
      ...key,
      clientKind: "Consumer",
      purposeId: generateId(),
      purposeState: "ACTIVE",
      agreementId: generateId(),
      agreementState: "ACTIVE",
      eServiceId: generateId(),
      eServiceState: "ACTIVE",
    };

    const aKey: ApiKey = {
      ...key,
      clientKind: clientKind.api,
    };

    doStuff(cKey);
    doStuff(aKey);
    doStuff(key);
  });
});

const doStuff = (input: Key): void => {
  // console.log(typeof input);
  // const res = ConsumerKey.safeParse(input);
  // console.log(res.error);
  if (ConsumerKey.safeParse(input).success) {
    console.log("consumer");
  } else if (ApiKey.safeParse(input).success) {
    console.log("api");
  } else {
    console.log("no idea");
  }
  console.log(input);
};
