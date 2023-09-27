import { z } from "zod";
import { AuthData } from "../auth/authData.js";

export const ctx = z.object({
  authData: AuthData,
  correlationId: z.string().uuid(),
});

export type AppContext = z.infer<typeof ctx>;
