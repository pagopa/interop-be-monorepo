import { ClientPurposeSchema } from "pagopa-interop-kpi-models";
import { z } from "zod";

export const ClientPurposeDeletingSchema = ClientPurposeSchema.pick({
  clientId: true,
  purposeId: true,
  deleted: true,
});
export type ClientPurposeDeletingSchema = z.infer<
  typeof ClientPurposeDeletingSchema
>;
