import {
  ReadModelRepository,
  initSesMailManager,
  logger,
  withExecutionTime,
  cleanupResources,
} from "pagopa-interop-commons";
import { CorrelationId, generateId } from "pagopa-interop-models";
import { makeDrizzleConnectionWithCleanup } from "pagopa-interop-readmodel";
import { config } from "./configs/config.js";
import { toCSV, toCsvDataRow } from "./utils/helpersUtils.js";
import { CSV_FILENAME, MAIL_BODY, MAIL_SUBJECT } from "./configs/constants.js";
import { readModelServiceBuilder } from "./services/readModelService.js";
import { readModelServiceBuilderSQL } from "./services/readModelServiceSQL.js";

const loggerInstance = logger({
  serviceName: "pn-consumers",
  correlationId: generateId<CorrelationId>(),
});
loggerInstance.info("Program started.\n");

loggerInstance.info("> Connecting to database...");

const { connection: readModelDB, cleanup: drizzleCleanup } =
  makeDrizzleConnectionWithCleanup(config);

async function main(): Promise<void> {
  try {
    const oldReadModelService = readModelServiceBuilder(
      ReadModelRepository.init(config)
    );
    const readModelServiceSQL = readModelServiceBuilderSQL(readModelDB);
    const readModelService =
      config.featureFlagSQL &&
      config.readModelSQLDbHost &&
      config.readModelSQLDbPort
        ? readModelServiceSQL
        : oldReadModelService;

    loggerInstance.info("> Connected to database!\n");

    loggerInstance.info("> Getting data...");

    const purposes = await readModelService.getSENDPurposes(
      config.pnEserviceId,
      config.comuniELoroConsorziEAssociazioniAttributeId
    );

    if (purposes.length === 0) {
      loggerInstance.info("> No purposes data found.");
      return;
    }

    const csv = toCSV(purposes.map((p) => toCsvDataRow(p, loggerInstance)));

    loggerInstance.info("> Data csv produced!\n");

    loggerInstance.info("> Sending emails...");

    const mailer = initSesMailManager(config);

    await mailer.send({
      from: {
        name: config.reportSenderLabel,
        address: config.reportSenderMail,
      },
      to: config.mailRecipients,
      subject: MAIL_SUBJECT,
      html: MAIL_BODY,
      attachments: [{ filename: CSV_FILENAME, content: csv }],
    });

    loggerInstance.info("> Success!\n");
  } catch (error) {
    loggerInstance.error(error);
  } finally {
    await cleanupResources(loggerInstance, drizzleCleanup);
  }
}

await withExecutionTime(main, loggerInstance);
