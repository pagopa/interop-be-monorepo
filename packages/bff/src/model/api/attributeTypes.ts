import { z } from "zod";
import {
  api as attribute,
  schemas,
} from "../generated/attribute-process/api.js";

export type AttributeProcessClientApi = typeof attribute.api;
export type AttributeProcessApi = z.infer<typeof schemas.Attribute>;
