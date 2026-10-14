import { createSelectSchema } from "drizzle-zod";
import { producerKeychainInReadmodelProducerKeychain } from "pagopa-interop-readmodel-models";
import { z } from "zod";

import { ProducerKeychainEServiceSchema } from "./producerKeychainEService.js";
import { ProducerKeychainKeySchema } from "./producerKeychainKey.js";
import { ProducerKeychainUserSchema } from "./producerKeychainUser.js";

export const ProducerKeychainSchema = createSelectSchema(
  producerKeychainInReadmodelProducerKeychain
).extend({
  deleted: z.boolean().default(false).optional(),
});
export type ProducerKeychainSchema = z.infer<typeof ProducerKeychainSchema>;

export const ProducerKeychainItemsSchema = z.object({
  producerKeychainSQL: ProducerKeychainSchema,
  usersSQL: z.array(ProducerKeychainUserSchema),
  eservicesSQL: z.array(ProducerKeychainEServiceSchema),
  keysSQL: z.array(ProducerKeychainKeySchema),
});
export type ProducerKeychainItemsSchema = z.infer<
  typeof ProducerKeychainItemsSchema
>;
