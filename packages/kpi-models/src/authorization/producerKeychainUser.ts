import { createSelectSchema } from "drizzle-zod";
import { producerKeychainUserInReadmodelProducerKeychain } from "pagopa-interop-readmodel-models";
import { z } from "zod";

export const ProducerKeychainUserSchema = createSelectSchema(
  producerKeychainUserInReadmodelProducerKeychain
).extend({
  deleted: z.boolean().default(false).optional(),
});
export type ProducerKeychainUserSchema = z.infer<
  typeof ProducerKeychainUserSchema
>;
