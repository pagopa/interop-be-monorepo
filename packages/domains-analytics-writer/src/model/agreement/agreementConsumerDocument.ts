import { z } from "zod";
import { AgreementConsumerDocumentSchema } from "pagopa-interop-kpi-models";

export const AgreementConsumerDocumentDeletingSchema =
  AgreementConsumerDocumentSchema.pick({
    id: true,
    deleted: true,
  });

export type AgreementConsumerDocumentDeletingSchema = z.infer<
  typeof AgreementConsumerDocumentDeletingSchema
>;
