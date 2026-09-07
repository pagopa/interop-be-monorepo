import { ProducerKeychainSchema } from "pagopa-interop-kpi-models";
import { z } from "zod";

export const ProducerKeychainDeletingSchema = ProducerKeychainSchema.pick({
  id: true,
  deleted: true,
});
export type ProducerKeychainDeletingSchema = z.infer<
  typeof ProducerKeychainDeletingSchema
>;
