import { createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { eserviceDescriptorInReadmodelCatalog } from "pagopa-interop-readmodel-models";

export const EserviceDescriptorSchema = createSelectSchema(
  eserviceDescriptorInReadmodelCatalog
)
  .omit({ audience: true, serverUrls: true })
  .extend({
    deleted: z.boolean().default(false).optional(),
    audience: z
      .array(z.string())
      .transform((val) => JSON.stringify(val))
      .pipe(z.string()),
    serverUrls: z
      .array(z.string())
      .transform((val) => JSON.stringify(val))
      .pipe(z.string()),
  });
export type EserviceDescriptorSchema = z.infer<typeof EserviceDescriptorSchema>;
