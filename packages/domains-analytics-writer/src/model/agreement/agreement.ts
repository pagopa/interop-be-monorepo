import { AgreementSchema } from "pagopa-interop-kpi-models";
import { z } from "zod";

export const AgreementDeletingSchema = AgreementSchema.pick({
  id: true,
  deleted: true,
});
export type AgreementDeletingSchema = z.infer<typeof AgreementDeletingSchema>;
