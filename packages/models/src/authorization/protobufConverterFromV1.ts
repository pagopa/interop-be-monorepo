import { KeyUseV1, KeyV1 } from "../gen/v1/authorization/key.js";
import { Key, KeyUse, keyUse } from "./key.js";

const fromKeyUseV1 = (input: KeyUseV1): KeyUse => {
  switch (input) {
    case KeyUseV1.SIG:
      return keyUse.sig;
    case KeyUseV1.ENC:
      return keyUse.enc;
    case KeyUseV1.UNSPECIFIED$: {
      throw new Error("Unspecified key use");
    }
  }
};

export const fromKeyV1 = (input: KeyV1): Key => ({
  ...input,
  use: fromKeyUseV1(input.use),
  createdAt: new Date(input.createdAt),
});
