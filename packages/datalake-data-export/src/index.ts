import { logger } from "pagopa-interop-commons";

const loggerInstance = logger({
  serviceName: "tenant-readmodel-writer",
});

loggerInstance.info("Datalake Data Exporter job is started");
