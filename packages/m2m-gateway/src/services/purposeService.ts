import { PagoPAInteropBeClients } from "../clients/clientsProvider.js";

export type PurposeService = ReturnType<typeof purposeServiceBuilder>;

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function purposeServiceBuilder(_clients: PagoPAInteropBeClients) {
  return {};
}
