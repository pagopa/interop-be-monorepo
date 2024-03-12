import { z } from "zod";
import * as api from "../generated/generated.js";

export type ApiClientComponentState = z.infer<
  typeof api.schemas.ClientComponentState
>;
