import { createSelectSchema } from "drizzle-zod";
import { eserviceDescriptorArchivingScheduleInReadmodelCatalog } from "pagopa-interop-readmodel-models";
import { z } from "zod";

export const EserviceDescriptorArchivingSchema = createSelectSchema(
  eserviceDescriptorArchivingScheduleInReadmodelCatalog
).extend({
  deleted: z.boolean().default(false).optional(),
});
export type EserviceDescriptorArchivingSchema = z.infer<
  typeof EserviceDescriptorArchivingSchema
>;
