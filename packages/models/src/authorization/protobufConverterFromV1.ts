import { UserId, unsafeBrandId } from "../brandedIds.js";
import { genericInternalError } from "../errors.js";
import { ClientKindV1, ClientV1 } from "../gen/v1/authorization/client.js";
import { KeyUseV1, KeyV1 } from "../gen/v1/authorization/key.js";
import { bigIntToDate } from "../utils.js";
import { Client, ClientKind, clientKind } from "./client.js";
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
  userId: input.userId ? unsafeBrandId<UserId>(input.userId) : undefined,
  use: fromKeyUseV1(input.use),
  createdAt: new Date(input.createdAt),
});

export const fromClientKindV1 = (input: ClientKindV1): ClientKind => {
  switch (input) {
    case ClientKindV1.CONSUMER:
      return clientKind.consumer;
    case ClientKindV1.API:
      return clientKind.api;
    case ClientKindV1.UNSPECIFIED$: {
      throw new Error("Unspecified client kind");
    }
  }
};

export const fromClientV1 = (input: ClientV1): Client => ({
  ...input,
  id: unsafeBrandId(input.id),
  consumerId: unsafeBrandId(input.consumerId),
  purposes: input.purposes.map((item) => {
    const purpose = item.states?.purpose;
    if (!purpose) {
      throw genericInternalError(
        "Error during purposes conversion in fromClientV1"
      );
    }
    return unsafeBrandId(purpose.purposeId);
  }),
  users: input.users.map(unsafeBrandId<UserId>),
  kind: fromClientKindV1(input.kind),
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  createdAt: bigIntToDate(input.createdAt!),
  keys: [],
});
