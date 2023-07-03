import { z } from "zod";
import { authData } from "./auth/authData.js";

export const appContext = z.object({
  authData,
});

export type AppContext = z.infer<typeof appContext>;
