import { PagoPAInteropBeClients } from "../clients/clientsProvider.js";

export type PurposeTemplateService = ReturnType<
  typeof purposeTemplateServiceBuilder
>;

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function purposeTemplateServiceBuilder(
  _clients: PagoPAInteropBeClients
) {
  return {
    async getPurposeTemplateById(): Promise<void> {
      return Promise.resolve();
    },
    async getPurposeTemplates(): Promise<void> {
      return Promise.resolve();
    },
    async createPurposeTemplate(): Promise<void> {
      return Promise.resolve();
    },
    async updatePurposeTemplate(): Promise<void> {
      return Promise.resolve();
    },
    async deletePurposeTemplate(): Promise<void> {
      return Promise.resolve();
    },
    async suspendPurposeTemplate(): Promise<void> {
      return Promise.resolve();
    },
    async archivePurposeTemplate(): Promise<void> {
      return Promise.resolve();
    },
    async unsuspendPurposeTemplate(): Promise<void> {
      return Promise.resolve();
    },
    async publishPurposeTemplate(): Promise<void> {
      return Promise.resolve();
    },
  };
}
