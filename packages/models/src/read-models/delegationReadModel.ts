import { z } from "zod";
import { Delegation } from "../delegation/delegation.js";

export const DelegationReadModel = Delegation;
export type DelegationReadModel = z.infer<typeof DelegationReadModel>;
