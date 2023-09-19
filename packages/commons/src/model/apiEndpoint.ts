import { z } from "zod";

export const APIEndpoint = z
  .string()
  .min(1)
  .transform((s) => s.replace(/\/+$/, ""))
  .brand<"APIEndpoint">();
