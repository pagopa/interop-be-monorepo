import { z } from "zod";
import { Branded, branded } from "./branded.js";

export type APIEndpoint = Branded<string, "APIEndpoint">;
export const APIEndpoint = branded(
  "APIEndpoint",
  z
    .string()
    .min(1)
    .transform((s) => s.replace(/\/+$/, ""))
);
