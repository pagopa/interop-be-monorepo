import { z } from "zod";
import { schemas } from "./generated/api.js";

const UserResponse = schemas.UserResponse.strip();
export type UserResponse = z.infer<typeof UserResponse>;
