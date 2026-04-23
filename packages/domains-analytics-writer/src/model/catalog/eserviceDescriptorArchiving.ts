import { createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { eserviceDescriptorArchivingScheduleInReadmodelCatalog } from "pagopa-interop-readmodel-models";

export const EserviceDescriptorArchivingSchema = createSelectSchema(
  eserviceDescriptorArchivingScheduleInReadmodelCatalog
).extend({
  deleted: z.boolean().default(false).optional(),
});
export type EserviceDescriptorArchivingSchema = z.infer<
  typeof EserviceDescriptorArchivingSchema
>;
