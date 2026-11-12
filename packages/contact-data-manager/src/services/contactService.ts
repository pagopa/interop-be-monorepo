import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { contactDataApi } from "pagopa-interop-api-clients";
import { AppContext, WithLogger } from "pagopa-interop-commons";
import { contact } from "pagopa-interop-contact-data-db-models";
import { generateId } from "pagopa-interop-models";

import {
  contactCreationFailed,
  contactNotFound,
  contactRetrievalFailed,
} from "../model/errors.js";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function contactServiceBuilder(db: ReturnType<typeof drizzle>) {
  return {
    getContact: async (
      contactId: contactDataApi.Contact["id"],
      { logger }: WithLogger<AppContext>
    ): Promise<contactDataApi.Contact> => {
      logger.info(`Retrieving contact ${contactId}`);

      const [savedContact] = await db
        .select({ id: contact.id, email: contact.email })
        .from(contact)
        .where(eq(contact.id, contactId))
        .limit(1)
        .catch(() => {
          logger.error(`Contact retrieval failed for contact ${contactId}`);
          throw contactRetrievalFailed();
        });

      if (!savedContact) {
        throw contactNotFound();
      }

      return savedContact;
    },
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
