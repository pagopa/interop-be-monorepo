import { z } from "zod";
import { ClientPurposeSchema } from "pagopa-interop-kpi-models";

export const ClientPurposeDeletingSchema = ClientPurposeSchema.pick({
  clientId: true,
  purposeId: true,
  deleted: true,
});
export type ClientPurposeDeletingSchema = z.infer<
  typeof ClientPurposeDeletingSchema
>;
