import { ReadModelRepository, initDB } from "pagopa-interop-commons";
import { selfcareV2InstitutionClientBuilder } from "pagopa-interop-api-clients";
import { config } from "../config/config.js";
import { readModelServiceBuilder } from "../services/readModelService.js";
import { authorizationServiceBuilder } from "../services/authorizationService.js";

const readModelService = readModelServiceBuilder(
  ReadModelRepository.init(config)
);

export const authorizationService = authorizationServiceBuilder(
  initDB({
    username: config.eventStoreDbUsername,
    password: config.eventStoreDbPassword,
    host: config.eventStoreDbHost,
    port: config.eventStoreDbPort,
    database: config.eventStoreDbName,
    schema: config.eventStoreDbSchema,
    useSSL: config.eventStoreDbUseSSL,
  }),
  readModelService,
  selfcareV2InstitutionClientBuilder(config)
);
