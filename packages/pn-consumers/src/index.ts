import { Logger, ReadModelRepository, logger } from "pagopa-interop-commons";
import { config } from "./configs/env.js";
import { ReadModelQueriesClient } from "./services/readModelQueriesService.js";
import { toCSV, toCsvDataRow } from "./utils/helpersUtils.js";
import { CSV_FILENAME, MAIL_BODY, MAIL_SUBJECT } from "./configs/constants.js";
import { Mailer } from "./services/mailerService.js";

const loggerInstance = logger({
  serviceName: "pn-consumers",
  correlationId: crypto.randomUUID(),
});

async function main(): Promise<void> {
  loggerInstance.info("Program started.\n");

  loggerInstance.info("> Connecting to database...");
  const readModel = ReadModelRepository.init(config);

  const readModelsQueriesClient = new ReadModelQueriesClient(readModel);
  loggerInstance.info("> Connected to database!\n");

  loggerInstance.info("> Getting data...");

  const purposes = await readModelsQueriesClient.getSENDPurposes(
    config.pnEserviceId,
    config.comuniELoroConsorziEAssociazioniAttributeId
  );

  if (purposes.length === 0) {
    loggerInstance.info("> No purposes data found. Exiting program.");
    process.exit(0);
  }

  const csv = toCSV(purposes.map((p) => toCsvDataRow(p, loggerInstance)));

  loggerInstance.info("> Data csv produced!\n");

  loggerInstance.info("> Sending emails...");

  const mailer = new Mailer({
    host: config.smtpAddress,
    port: config.smtpPort,
    secure: config.smtpSecure,
    auth: {
      user: config.smtpUser,
      pass: config.smtpPassword,
    },
  });

  await mailer.sendMail({
    from: {
      name: config.reportSenderLabel,
      address: config.reportSenderMail,
    },
    to: config.mailRecipients,
    subject: MAIL_SUBJECT,
    text: MAIL_BODY,
    attachments: [{ filename: CSV_FILENAME, content: csv }],
  });

  loggerInstance.info("> Success!\n");
  loggerInstance.info("End of program.");

  await readModelsQueriesClient.close();
  process.exit(0);
}

/**
 * Calls a function and logs the execution time.
 *
 * @param fn The function to call
 * @returns The result of the function
 */
export async function withExecutionTime(
  fn: () => void | Promise<void>,
  logger: Logger
): Promise<void> {
  const t0 = performance.now();
  await fn();
  const t1 = performance.now();
  const executionTimeMs = t1 - t0;
  const executionTimeSeconds = Math.round((executionTimeMs / 1000) * 10) / 10;
  logger.info(`Execution time: ${executionTimeSeconds}s`);
}

await withExecutionTime(main, loggerInstance);
