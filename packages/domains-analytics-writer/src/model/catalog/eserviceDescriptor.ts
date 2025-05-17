import { createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import {
  eserviceDescriptorInReadmodelCatalog,
  EServiceDescriptorSQL,
} from "pagopa-interop-readmodel-models";

export const EserviceDescriptorSchema = createSelectSchema(
  eserviceDescriptorInReadmodelCatalog
).extend({
  deleted: z.boolean().default(false).optional(),
  audience: z.string(),
  serverUrls: z.string(),
});
export type EserviceDescriptorSchema = z.infer<typeof EserviceDescriptorSchema>;

export type EserviceDescriptorMapping = {
  [K in keyof EserviceDescriptorSchema]: (
    record: EServiceDescriptorSQL
  ) => EserviceDescriptorSchema[K];
};

export const EserviceDescriptorDeletingSchema = EserviceDescriptorSchema.pick({
  id: true,
  deleted: true,
});
export type EserviceDescriptorDeletingSchema = z.infer<
  typeof EserviceDescriptorDeletingSchema
>;

export type EserviceDescriptorDeletingMapping = {
  [K in keyof EserviceDescriptorDeletingSchema]: (
    record: Pick<EServiceDescriptorSQL, "id">
  ) => EserviceDescriptorDeletingSchema[K];
};
