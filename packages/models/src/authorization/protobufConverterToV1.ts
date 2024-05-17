import { match } from "ts-pattern";
import { KeyUseV1, KeyV1 } from "../gen/v1/authorization/key.js";
import { Key, KeyUse, keyUse } from "./key.js";

const toKeyUseV1 = (input: KeyUse): KeyUseV1 =>
  match(input)
    .with(keyUse.sig, () => KeyUseV1.SIG)
    .with(keyUse.enc, () => KeyUseV1.ENC)
    .exhaustive();

export const toKeyV1 = (input: Key): KeyV1 => ({
  ...input,
  use: toKeyUseV1(input.use),
  createdAt: input.createdAt.toString(),
});
