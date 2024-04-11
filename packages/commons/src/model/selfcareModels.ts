import { z } from "zod";
import * as api from "./generated/api.js";

const UserResponse = api.schemas.UserResponse.strip();
export type UserResponse = z.infer<typeof UserResponse>;
