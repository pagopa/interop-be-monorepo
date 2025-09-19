import {
  initSesMailManager,
  logger,
  withExecutionTime,
} from "pagopa-interop-commons";
import { CorrelationId, generateId } from "pagopa-interop-models";
import { makeDrizzleConnection } from "pagopa-interop-readmodel";
import { config } from "./configs/config.js";
import { toCSV, toCsvDataRow } from "./utils/helpersUtils.js";
import { CSV_FILENAME, MAIL_BODY, MAIL_SUBJECT } from "./configs/constants.js";
import { readModelServiceBuilderSQL } from "./services/readModelServiceSQL.js";

const loggerInstance = logger({
  serviceName: "pn-consumers",
  correlationId: generateId<CorrelationId>(),
});

async function main(): Promise<void> {
  loggerInstance.info("Program started.\n");

  loggerInstance.info("> Connecting to database...");

  const readModelDB = makeDrizzleConnection(config);

  const readModelServiceSQL = readModelServiceBuilderSQL(readModelDB);

  loggerInstance.info("> Connected to database!\n");

  loggerInstance.info("> Getting data...");

  const purposes = await readModelServiceSQL.getSENDPurposes(
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

  await mailer.send(
    {
      from: {
        name: config.reportSenderLabel,
        address: config.reportSenderMail,
      },
      to: config.mailRecipients,
      subject: MAIL_SUBJECT,
      html: MAIL_BODY,
      attachments: [{ filename: CSV_FILENAME, content: csv }],
    },
    loggerInstance
  );

  loggerInstance.info("> Success!\n");
}

await withExecutionTime(main, loggerInstance);

process.exit(0);
// process.exit() should not be required.
// however, something in this script hangs on exit.
// TODO figure out why and remove this workaround.
