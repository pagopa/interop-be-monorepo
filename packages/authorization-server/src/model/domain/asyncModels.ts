import { InteractionState } from "pagopa-interop-models";

export type AsyncActorRole = "fruitore" | "erogatore";

export const asyncScopeToActorRole = (
  scope: InteractionState
): AsyncActorRole =>
  scope === "callback_invocation" ? "erogatore" : "fruitore";
