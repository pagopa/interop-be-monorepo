/* eslint-disable no-console */
import {
  EmailManagerSES,
  initSesMailManager,
  logger,
} from "pagopa-interop-commons";
import { config } from "./config/config.js";

// -- tweakable configs
const recipient = "matteo.grilli@dev.buildo.com";
const nMails = 30;

const sesEmailManager: EmailManagerSES = initSesMailManager(config, {
  skipTooManyRequestsError: false,
});

const loggerInstance = logger({
  serviceName: "email-sender",
});

const promises = [];
// eslint-disable-next-line functional/no-let
for (let i = 0; i < nMails; i++) {
  // eslint-disable-next-line functional/immutable-data
  promises.push(async () => {
    try {
      const mailOptions = {
        from: { name: config.senderLabel, address: config.senderMail },
        subject: `Test mail ${i}`,
        to: [recipient],
        html: "This is a test email",
      };
      await sesEmailManager.send(mailOptions, loggerInstance);
      console.log(`Email ${i} sent to ${recipient}`);
    } catch (err) {
      console.error(`Error sending email. Error: ${err}`);
    }
  });
}

await Promise.allSettled(promises);
