import { z } from "zod";
import * as api from "./generated/api.js";

export type ApiClientComponentState = z.infer<
  typeof api.schemas.ClientComponentState
>;
