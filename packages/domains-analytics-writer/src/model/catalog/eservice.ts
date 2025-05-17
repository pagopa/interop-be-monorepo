import { createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import {
  eserviceInReadmodelCatalog,
  EServiceSQL,
} from "pagopa-interop-readmodel-models";

export const EserviceSchema = createSelectSchema(
  eserviceInReadmodelCatalog
).extend({
  deleted: z.boolean().default(false).optional(),
});
export type EserviceSchema = z.infer<typeof EserviceSchema>;

export type EserviceMapping = {
  [K in keyof EserviceSchema]: (record: EServiceSQL) => EserviceSchema[K];
};

export const EserviceDeletingSchema = EserviceSchema.pick({
  id: true,
  deleted: true,
});
export type EserviceDeletingSchema = z.infer<typeof EserviceDeletingSchema>;

export type EserviceDeletingMapping = {
  [K in keyof EserviceDeletingSchema]: (
    record: Pick<EserviceDeletingSchema, "id">
  ) => EserviceDeletingSchema[K];
};
