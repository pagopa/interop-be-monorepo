import { AxiosError, AxiosHeaders } from "axios";
import { contactDataApi } from "pagopa-interop-api-clients";
import { Logger, RefreshableInteropToken } from "pagopa-interop-commons";
import { ContactId, CorrelationId, generateId } from "pagopa-interop-models";
import { describe, expect, it, vi } from "vitest";

import { contactCreationFailed } from "../../src/model/domain/errors.js";
import { contactDataManagerServiceBuilder } from "../../src/services/contactDataManagerService.js";

describe("contactDataManagerService", () => {
  const email = "contact@test.it";
  const correlationId = generateId<CorrelationId>();

  const setup = (createContact: () => Promise<unknown>) => {
    const client = { createContact: vi.fn(createContact) };
    const refreshableToken = {
      get: vi.fn().mockResolvedValue({ serialized: "token" }),
    };
    const logger = {
      debug: vi.fn(),
      error: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
    };
    const service = contactDataManagerServiceBuilder(
      client as unknown as contactDataApi.ContactDataManagerClient,
      refreshableToken as unknown as RefreshableInteropToken
    );
    return { service, client, logger };
  };

  const loggedText = (logger: ReturnType<typeof setup>["logger"]): string =>
    JSON.stringify(Object.values(logger).map((fn) => fn.mock.calls));

  // The request config of an axios error carries the email address
  const axiosError = (status: number): AxiosError => {
    const config = {
      headers: new AxiosHeaders(),
      data: JSON.stringify({ email }),
    };
    return new AxiosError(
      `Request failed with status code ${status}`,
      AxiosError.ERR_BAD_RESPONSE,
      config,
      undefined,
      { status, statusText: "", headers: {}, config, data: {} }
    );
  };

  it("Should return the id of the created contact", async () => {
    const contactId = generateId<ContactId>();
    const { service, client, logger } = setup(() =>
      Promise.resolve({ id: contactId, email })
    );

    const result = await service.createContact(email, {
      correlationId,
      logger: logger as unknown as Logger,
    });

    expect(result).toEqual({ type: "created", contactId });
    expect(client.createContact).toHaveBeenCalledWith(
      { email },
      {
        headers: expect.objectContaining({
          Authorization: "Bearer token",
          "X-Correlation-Id": correlationId,
        }),
      }
    );
  });

  it("Should return invalidEmail when the Contact Data Manager rejects the email", async () => {
    const { service, logger } = setup(() => Promise.reject(axiosError(400)));

    const result = await service.createContact(email, {
      correlationId,
      logger: logger as unknown as Logger,
    });

    expect(result).toEqual({ type: "invalidEmail" });
  });

  it("Should throw contactCreationFailed with the status only, never the email", async () => {
    const { service, logger } = setup(() => Promise.reject(axiosError(503)));

    const error = await service
      .createContact(email, {
        correlationId,
        logger: logger as unknown as Logger,
      })
      .catch((e: unknown) => e);

    expect(error).toEqual(contactCreationFailed("status 503"));
    expect(JSON.stringify(error)).not.toContain(email);
    expect(String(error)).not.toContain(email);
    expect(loggedText(logger)).not.toContain(email);
  });

  it("Should throw contactCreationFailed for a non-axios error", async () => {
    const { service, logger } = setup(() =>
      Promise.reject(new Error(`unexpected ${email}`))
    );

    await expect(
      service.createContact(email, {
        correlationId,
        logger: logger as unknown as Logger,
      })
    ).rejects.toThrowError(contactCreationFailed("unexpected error"));
    expect(loggedText(logger)).not.toContain(email);
  });
});
