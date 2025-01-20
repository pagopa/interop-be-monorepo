import { ZodiosEndpointDefinitions } from "@zodios/core";
import { ZodiosRouter } from "@zodios/express";
import {
  ExpressContext,
  ZodiosContext,
  ReadModelRepository,
  initDB,
  initFileManager,
  zodiosValidationErrorToApiProblem,
} from "pagopa-interop-commons";
import { catalogApi } from "pagopa-interop-api-clients";
import { config } from "../config/config.js";
import { readModelServiceBuilder } from "../services/readModelService.js";
import { eserviceTemplateServiceBuilder } from "../services/eserviceTemplateService.js";

const readModelService = readModelServiceBuilder(
  ReadModelRepository.init(config)
);

const eserviceTemplateService = eserviceTemplateServiceBuilder(
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
  initFileManager(config)
);

const eserviceTemplatesRouter = (
  ctx: ZodiosContext
): ZodiosRouter<ZodiosEndpointDefinitions, ExpressContext> => {
  const eserviceTemplatesRouter = ctx.router(catalogApi.processApi.api, {
    validationErrorHandler: zodiosValidationErrorToApiProblem,
  });

  // const {
  //   ADMIN_ROLE,
  //   SECURITY_ROLE,
  //   API_ROLE,
  //   M2M_ROLE,
  //   SUPPORT_ROLE,
  // } = userRoles;
    
  return eserviceTemplatesRouter;
};
export default eserviceTemplatesRouter;
