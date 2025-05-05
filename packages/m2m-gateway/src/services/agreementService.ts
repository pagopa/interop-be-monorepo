import { PagoPAInteropBeClients } from "../clients/clientsProvider.js";

export type AgreementService = ReturnType<typeof agreementServiceBuilder>;

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function agreementServiceBuilder(_clients: PagoPAInteropBeClients) {
  return {};
}
