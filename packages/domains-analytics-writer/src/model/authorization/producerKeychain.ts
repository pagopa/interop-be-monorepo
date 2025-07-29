import { createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { producerKeychainInReadmodelProducerKeychain } from "pagopa-interop-readmodel-models";
import { ProducerKeychainEServiceSchema } from "./producerKeychainEService.js";
import { ProducerKeychainKeySchema } from "./producerKeychainKey.js";
import { ProducerKeychainUserSchema } from "./producerKeychainUser.js";

export const ProducerKeychainSchema = createSelectSchema(
  producerKeychainInReadmodelProducerKeychain
).extend({
  deleted: z.boolean().default(false).optional(),
});
export type ProducerKeychainSchema = z.infer<typeof ProducerKeychainSchema>;

export const ProducerKeychainDeletingSchema = ProducerKeychainSchema.pick({
  id: true,
  deleted: true,
});
export type ProducerKeychainDeletingSchema = z.infer<
  typeof ProducerKeychainDeletingSchema
>;

export const ProducerKeychainItemsSchema = z.object({
  producerKeychainSQL: ProducerKeychainSchema,
  usersSQL: z.array(ProducerKeychainUserSchema),
  eservicesSQL: z.array(ProducerKeychainEServiceSchema),
  keysSQL: z.array(ProducerKeychainKeySchema),
});
export type ProducerKeychainItemsSchema = z.infer<
  typeof ProducerKeychainItemsSchema
>;
