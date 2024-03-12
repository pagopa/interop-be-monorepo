import { z } from "zod";
import * as api from "../../generated/generated.js";

export type ApiAttributeKind = z.infer<typeof api.schemas.AttributeKind>;
