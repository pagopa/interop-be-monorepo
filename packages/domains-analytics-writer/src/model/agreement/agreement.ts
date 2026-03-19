import { z } from "zod";
import { AgreementSchema } from "pagopa-interop-kpi-models";

export const AgreementDeletingSchema = AgreementSchema.pick({
  id: true,
  deleted: true,
});
export type AgreementDeletingSchema = z.infer<typeof AgreementDeletingSchema>;
