import { createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { eserviceDescriptorInReadmodelCatalog } from "pagopa-interop-readmodel-models";

export const EserviceDescriptorSchema = createSelectSchema(
  eserviceDescriptorInReadmodelCatalog
).extend({
  deleted: z.boolean().default(false).optional(),
  audience: z.string(),
  serverUrls: z.string(),
});
export type EserviceDescriptorSchema = z.infer<typeof EserviceDescriptorSchema>;

export const EserviceDescriptorDeletingSchema = EserviceDescriptorSchema.pick({
  id: true,
  deleted: true,
});
export type EserviceDescriptorDeletingSchema = z.infer<
  typeof EserviceDescriptorDeletingSchema
>;
