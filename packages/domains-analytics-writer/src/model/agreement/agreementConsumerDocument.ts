import { AgreementConsumerDocumentSchema } from "pagopa-interop-kpi-models";
import { z } from "zod";

export const AgreementConsumerDocumentDeletingSchema =
  AgreementConsumerDocumentSchema.pick({
    id: true,
    deleted: true,
  });

export type AgreementConsumerDocumentDeletingSchema = z.infer<
  typeof AgreementConsumerDocumentDeletingSchema
>;
