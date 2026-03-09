import { z } from "zod";
import {
  AgreementSchema,
  AgreementConsumerDocumentSchema,
} from "pagopa-interop-kpi-models";

// Additional schemas specific to domains-analytics-writer
export const AgreementDeletingSchema = AgreementSchema.pick({
  id: true,
  deleted: true,
});
export type AgreementDeletingSchema = z.infer<typeof AgreementDeletingSchema>;

export const AgreementConsumerDocumentDeletingSchema =
  AgreementConsumerDocumentSchema.pick({
    id: true,
    deleted: true,
  });
export type AgreementConsumerDocumentDeletingSchema = z.infer<
  typeof AgreementConsumerDocumentDeletingSchema
>;
