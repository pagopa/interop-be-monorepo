import { z } from "zod";
import { PurposeVersionSchema } from "pagopa-interop-kpi-models";

export const PurposeVersionDeletingSchema = PurposeVersionSchema.pick({
  id: true,
  deleted: true,
});
export type PurposeVersionDeletingSchema = z.infer<
  typeof PurposeVersionDeletingSchema
>;
