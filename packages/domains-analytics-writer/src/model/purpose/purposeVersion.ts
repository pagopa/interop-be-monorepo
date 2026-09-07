import { PurposeVersionSchema } from "pagopa-interop-kpi-models";
import { z } from "zod";

export const PurposeVersionDeletingSchema = PurposeVersionSchema.pick({
  id: true,
  deleted: true,
});
export type PurposeVersionDeletingSchema = z.infer<
  typeof PurposeVersionDeletingSchema
>;
