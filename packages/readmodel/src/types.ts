import { InferSelectModel } from "drizzle-orm";
import {
  delegationContractDocumentInReadmodel,
  delegationInReadmodel,
  delegationStampInReadmodel,
} from "./drizzle/schema.js";

export type DelegationSQL = InferSelectModel<typeof delegationInReadmodel>;
export type DelegationStampSQL = InferSelectModel<
  typeof delegationStampInReadmodel
>;
export type DelegationContractDocumentSQL = InferSelectModel<
  typeof delegationContractDocumentInReadmodel
>;
