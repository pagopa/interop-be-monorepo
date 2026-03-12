import { createSelectSchema } from "drizzle-zod";
import { clientUserInReadmodelClient } from "pagopa-interop-readmodel-models";
import { z } from "zod";

export const ClientUserSchema = createSelectSchema(
  clientUserInReadmodelClient
).extend({
  deleted: z.boolean().default(false).optional(),
});
export type ClientUserSchema = z.infer<typeof ClientUserSchema>;

export const ClientUserDeletingSchema = ClientUserSchema.pick({
  clientId: true,
  userId: true,
  deleted: true,
});
export type ClientUserDeletingSchema = z.infer<typeof ClientUserDeletingSchema>;
