import { drizzle } from "drizzle-orm/node-postgres";
import { contactDataApi } from "pagopa-interop-api-clients";
import { AppContext, WithLogger } from "pagopa-interop-commons";
import { contact } from "pagopa-interop-contact-data-db-models";
import { generateId } from "pagopa-interop-models";

import { contactCreationFailed } from "../model/errors.js";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function contactServiceBuilder(db: ReturnType<typeof drizzle>) {
  return {
    createContact: async (
      seed: contactDataApi.ContactSeed,
      { logger }: WithLogger<AppContext>
    ): Promise<contactDataApi.Contact> => {
      const newContact: contactDataApi.Contact = {
        id: generateId(),
        email: seed.email,
      };
      logger.info(`Creating contact ${newContact.id}`);

      try {
        await db.insert(contact).values({
          ...newContact,
          createdAt: new Date().toISOString(),
        });
      } catch {
        // Driver errors can contain the SQL parameters, including the email.
        logger.error(`Contact creation failed for contact ${newContact.id}`);
        throw contactCreationFailed();
      }

      return newContact;
    },
  };
}

export type ContactService = ReturnType<typeof contactServiceBuilder>;
