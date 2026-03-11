import { z } from "zod";

export const AsyncScope = z.enum([
  "start_interaction",
  "callback_invocation",
  "get_resource",
  "confirmation",
]);
export type AsyncScope = z.infer<typeof AsyncScope>;

export type AsyncActorRole = "fruitore" | "erogatore";

export const asyncScopeToActorRole = (scope: AsyncScope): AsyncActorRole =>
  scope === "callback_invocation" ? "erogatore" : "fruitore";
