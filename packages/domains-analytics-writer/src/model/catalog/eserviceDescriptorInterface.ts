import { createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import {
  eserviceDescriptorInterfaceInReadmodelCatalog,
  EServiceDescriptorInterfaceSQL,
} from "pagopa-interop-readmodel-models";

export const EserviceDescriptorInterfaceSchema = createSelectSchema(
  eserviceDescriptorInterfaceInReadmodelCatalog
).extend({
  deleted: z.boolean().default(false).optional(),
});
export type EserviceDescriptorInterfaceSchema = z.infer<
  typeof EserviceDescriptorInterfaceSchema
>;

export type EserviceDescriptorInterfaceMapping = {
  [K in keyof EserviceDescriptorInterfaceSchema]: (
    record: EServiceDescriptorInterfaceSQL
  ) => EserviceDescriptorInterfaceSchema[K];
};

export const EserviceDescriptorInterfaceDeletingSchema =
  EserviceDescriptorInterfaceSchema.pick({
    id: true,
    deleted: true,
  });
export type EserviceDescriptorInterfaceDeletingSchema = z.infer<
  typeof EserviceDescriptorInterfaceDeletingSchema
>;

export type EserviceDescriptorInterfaceDeletingMapping = {
  [K in keyof EserviceDescriptorInterfaceDeletingSchema]: (
    record: Pick<EServiceDescriptorInterfaceSQL, "id">
  ) => EserviceDescriptorInterfaceDeletingSchema[K];
};
