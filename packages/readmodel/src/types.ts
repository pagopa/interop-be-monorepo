import { InferSelectModel } from "drizzle-orm";
import {
  agreementAttributeInReadmodel,
  agreementDocumentInReadmodel,
  agreementInReadmodel,
  agreementStampInReadmodel,
} from "./drizzle/schema.js";

export type AgreementAttributeSQL = InferSelectModel<
  typeof agreementAttributeInReadmodel
>;
export type AgreementDocumentSQL = InferSelectModel<
  typeof agreementDocumentInReadmodel
>;
export type AgreementStampSQL = InferSelectModel<
  typeof agreementStampInReadmodel
>;
export type AgreementSQL = InferSelectModel<typeof agreementInReadmodel>;
