import { z } from "zod";
import { AuthData } from "./auth/authData.js";

export const appContext = z.object({
  authData: AuthData,
});

export type AppContext = z.infer<typeof appContext>;
