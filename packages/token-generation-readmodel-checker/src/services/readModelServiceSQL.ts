import { Agreement, Client, EService, Purpose } from "pagopa-interop-models";
import { overallReadModelServiceBuilder } from "pagopa-interop-readmodel";
import { DrizzleReturnType } from "pagopa-interop-readmodel-models";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function readModelServiceBuilderSQL(readModelDB: DrizzleReturnType) {
  const overallReadModelService = overallReadModelServiceBuilder(readModelDB);
  return {
    async getAllReadModelEServices(): Promise<EService[]> {
      return (await overallReadModelService.getAllEServices()).map(
        (e) => e.data
      );
    },

    async getAllReadModelPurposes(): Promise<Purpose[]> {
      return (await overallReadModelService.getAllPurposes()).map(
        (p) => p.data
      );
    },

    async getAllReadModelAgreements(): Promise<Agreement[]> {
      return (await overallReadModelService.getAllAgreements()).map(
        (a) => a.data
      );
    },

    async getAllReadModelClients(): Promise<Client[]> {
      return (await overallReadModelService.getAllClients()).map((c) => c.data);
    },
  };
}
export type ReadModelServiceSQL = ReturnType<typeof readModelServiceBuilderSQL>;
