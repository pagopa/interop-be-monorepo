import { createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { eserviceTemplateVersionAsyncExchangePropertiesInReadmodelEserviceTemplate } from "pagopa-interop-readmodel-models";

export const EserviceTemplateVersionAsyncExchangePropertiesSchema =
  createSelectSchema(
    eserviceTemplateVersionAsyncExchangePropertiesInReadmodelEserviceTemplate
  ).extend({
    deleted: z.boolean().default(false).optional(),
  });
export type EserviceTemplateVersionAsyncExchangePropertiesSchema = z.infer<
  typeof EserviceTemplateVersionAsyncExchangePropertiesSchema
>;
