import { createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { producerKeychainEserviceInReadmodelProducerKeychain } from "pagopa-interop-readmodel-models";

export const ProducerKeychainEServiceSchema = createSelectSchema(
  producerKeychainEserviceInReadmodelProducerKeychain
).extend({
  deleted: z.boolean().default(false).optional(),
});
export type ProducerKeychainEServiceSchema = z.infer<
  typeof ProducerKeychainEServiceSchema
>;

export const ProducerKeychainEServiceDeletingSchema =
  ProducerKeychainEServiceSchema.pick({
    producerKeychainId: true,
    eserviceId: true,
    deleted: true,
  });
export type ProducerKeychainEServiceDeletingSchema = z.infer<
  typeof ProducerKeychainEServiceDeletingSchema
>;
