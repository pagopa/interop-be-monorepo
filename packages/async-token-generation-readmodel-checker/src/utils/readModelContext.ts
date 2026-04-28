import { Agreement, Client, EService, Purpose } from "pagopa-interop-models";
import {
  ProducerKeychainReadModelEntry,
  ReadModelServiceSQL,
} from "../services/readModelServiceSQL.js";

export type ReadModelContext = {
  eservices: EService[];
  purposes: Purpose[];
  agreements: Agreement[];
  clients: Client[];
  producerKeychains: ProducerKeychainReadModelEntry[];
};

export const collectReadModelContext = async (
  readModelService: ReadModelServiceSQL
): Promise<ReadModelContext> => ({
  eservices: await readModelService.getAllReadModelEServices(),
  purposes: await readModelService.getAllReadModelPurposes(),
  agreements: await readModelService.getAllReadModelAgreements(),
  clients: await readModelService.getAllReadModelClients(),
  producerKeychains:
    await readModelService.getAllProducerKeychainReadModelEntries(),
});
