import { ReadModelRepository, logger } from "pagopa-interop-commons";
import { v4 as uuidv4 } from "uuid";
import axios from "axios";
import { config } from "./config/config.js";
import { readModelServiceBuilder } from "./services/readModelService.js";
import { extractInstitutionsData } from "./services/openDataExtractor.js";

const loggerInstance = logger({
  serviceName: "ipa-certified-attributes-importer",
  correlationId: uuidv4(),
});

loggerInstance.info("Starting ipa-certified-attributes-importer");

try {
  type IPAData = {
    codice: string;
  };

  // eslint-disable-next-line functional/no-let, prefer-const, sonarjs/no-unused-collection
  let ipalist: IPAData[] = [];

  const institutions = await exractInstitutionsData(config.institutionsUrl);

  for (const endpoint of config.IPAEndpoints) {
    loggerInstance.info(`Processing endpoint ${endpoint}`);

    const ipaCertifiedAttributes = await axios.get(endpoint);

    if (!ipaCertifiedAttributes.data.fields) {
      loggerInstance.error("Fields not found");
      throw new Error("Fields not found");
    }

    if (!ipaCertifiedAttributes.data.records) {
      loggerInstance.error("Records not found");
      throw new Error("Records not found");
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const field = (ipaCertifiedAttributes.data.fields as any[])
      .map((f, index) => [f, index])
      .find(([f, _]) => f.id === "Codice_IPA");

    if (!field) {
      loggerInstance.error("Codice_IPA field not found");
      throw new Error("Codice_IPA field not found");
    }

    const [, position] = field;

    const ipaDataList = ipaCertifiedAttributes.data.records.map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (record: any[]) => ({
        codice: record[position],
      })
    );

    // eslint-disable-next-line functional/immutable-data
    ipalist = [...ipalist, ...ipaDataList];
  }

  const readModelService = readModelServiceBuilder(
    ReadModelRepository.init(config)
  );

  const ipaTenants = await readModelService.getIPATenants();

  for (const ipaTenant of ipaTenants) {
    const ipaData = ipalist.find(
      (ipa) => ipa.codice === ipaTenant.externalId.value
    );

    if (!ipaData) {
      loggerInstance.warn(
        `IPA data not found for tenant ${ipaTenant.externalId.value}`
      );
      continue;
    }

    loggerInstance.info(
      `Found IPA data for tenant ${ipaTenant.externalId.value}`
    );
    // assign ipa data attribute to tenant

    // revoke tenat attribute if not present in ipa data
  }
} catch (error) {
  loggerInstance.error(error);
}
