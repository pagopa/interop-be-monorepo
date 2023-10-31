// import {
//   AuthData,
//   CreateEvent,
//   eventRepository,
//   initDB,
//   logger,
// } from "pagopa-interop-commons";
// import { tenantEventToBinaryData } from "pagopa-interop-models";
// import { config } from "../utilities/config.js";
// import { readModelService } from "./readModelService.js";

// const repository = eventRepository(
//   initDB({
//     username: config.eventStoreDbUsername,
//     password: config.eventStoreDbPassword,
//     host: config.eventStoreDbHost,
//     port: config.eventStoreDbPort,
//     database: config.eventStoreDbName,
//     schema: config.eventStoreDbSchema,
//     useSSL: config.eventStoreDbUseSSL,
//   }),
//   tenantEventToBinaryData
// );
