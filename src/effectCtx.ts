import * as Context from "@effect/data/Context";
import { DB } from "./repositories/db.js";
import { AuthData } from "./auth/authData.js";

export const DBCtx = Context.Tag<DB>();
export const AuthDataCtx = Context.Tag<AuthData>();
