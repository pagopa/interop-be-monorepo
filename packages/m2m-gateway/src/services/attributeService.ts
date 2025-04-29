import { PagoPAInteropBeClients } from "../clients/clientsProvider.js";

export type AttributeService = ReturnType<typeof attributeServiceBuilder>;

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function attributeServiceBuilder(_clients: PagoPAInteropBeClients) {
  return {};
}
