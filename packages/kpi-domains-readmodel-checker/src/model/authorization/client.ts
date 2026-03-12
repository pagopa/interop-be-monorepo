import { createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { clientInReadmodelClient } from "pagopa-interop-readmodel-models";
import { ClientPurposeSchema } from "./clientPurpose.js";
import { ClientKeySchema } from "./clientKey.js";
import { ClientUserSchema } from "./clientUser.js";

export const ClientSchema = createSelectSchema(clientInReadmodelClient).extend({
  deleted: z.boolean().default(false).optional(),
});
export type ClientSchema = z.infer<typeof ClientSchema>;

export const ClientItemsSchema = z.object({
  clientSQL: ClientSchema,
  usersSQL: z.array(ClientUserSchema),
  purposesSQL: z.array(ClientPurposeSchema),
  keysSQL: z.array(ClientKeySchema),
});
export type ClientItemsSchema = z.infer<typeof ClientItemsSchema>;
