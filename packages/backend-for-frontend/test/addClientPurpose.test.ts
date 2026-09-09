import { AxiosError, InternalAxiosRequestConfig } from "axios";
import { getMockAuthData, getMockContext } from "pagopa-interop-commons-test";
import { generateId, Problem } from "pagopa-interop-models";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PagoPAInteropBeClients } from "../src/clients/clientsProvider.js";
import {
  EVENT_CONFLICT_MAX_ATTEMPTS,
  EVENT_CONFLICT_RETRY_DELAY_MS,
} from "../src/config/constants.js";
import { clientServiceBuilder } from "../src/services/clientService.js";
import { getBffMockContext } from "./utils.js";

describe("addClientPurpose", () => {
  const clientId = generateId();
  const purposeId = generateId();
  const ctx = getBffMockContext(
    getMockContext({ authData: getMockAuthData() })
  );

  const addClientPurpose = vi.fn();
  const mockClients = {
    authorizationClient: {
      client: {
        addClientPurpose,
      },
    },
  } as unknown as PagoPAInteropBeClients;

  const clientService = clientServiceBuilder(mockClients);

  const axiosError = (
    problem: Problem,
    data: unknown = problem
  ): AxiosError<Problem> =>
    new AxiosError(
      "Downstream error",
      String(problem.status),
      undefined,
      undefined,
      {
        status: problem.status,
        data: data as Problem,
        statusText: problem.title,
        config: {} as InternalAxiosRequestConfig,
        headers: {},
      }
    );

  // Literal codes pin the wire format of authorization-process (006)
  // independently from the constants under test.
  const eventConflictProblem: Problem = {
    type: "about:blank",
    title: "Conflict",
    status: 409,
    detail: "Request conflicts with an ongoing operation. Please retry.",
    correlationId: ctx.correlationId,
    errors: [
      {
        code: "006-10034",
        detail: "Request conflicts with an ongoing operation. Please retry.",
      },
    ],
  };

  const purposeAlreadyLinkedProblem: Problem = {
    ...eventConflictProblem,
    errors: [
      {
        code: "006-0013",
        detail: `Purpose ${purposeId} is already linked to client ${clientId}`,
      },
    ],
  };

  // The retry sleeps between attempts. Fake timers keep the tests fast
  // and let the exhaustion case run all attempts.
  const runAllRetries = async (): Promise<void> => {
    await vi.advanceTimersByTimeAsync(
      EVENT_CONFLICT_RETRY_DELAY_MS * (EVENT_CONFLICT_MAX_ATTEMPTS - 1)
    );
  };

  beforeEach(() => {
    vi.useFakeTimers();
    addClientPurpose.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should retry authorization event conflicts and complete the association", async () => {
    addClientPurpose
      .mockRejectedValueOnce(axiosError(eventConflictProblem))
      .mockResolvedValueOnce(undefined);

    const result = expect(
      clientService.addClientPurpose(clientId, { purposeId }, ctx)
    ).resolves.toBeUndefined();
    await runAllRetries();
    await result;

    expect(addClientPurpose).toHaveBeenCalledTimes(2);
    expect(addClientPurpose).toHaveBeenNthCalledWith(
      2,
      { purposeId },
      { params: { clientId }, headers: ctx.headers }
    );
  });

  it("should stop after the configured attempts and rethrow the last conflict", async () => {
    const lastConflict = axiosError(eventConflictProblem);
    addClientPurpose.mockRejectedValue(lastConflict);

    const result = expect(
      clientService.addClientPurpose(clientId, { purposeId }, ctx)
    ).rejects.toBe(lastConflict);
    await runAllRetries();
    await result;

    expect(addClientPurpose).toHaveBeenCalledTimes(EVENT_CONFLICT_MAX_ATTEMPTS);
  });

  it("should not retry other conflicts", async () => {
    const conflict = axiosError(purposeAlreadyLinkedProblem);
    addClientPurpose.mockRejectedValue(conflict);

    await expect(
      clientService.addClientPurpose(clientId, { purposeId }, ctx)
    ).rejects.toBe(conflict);

    expect(addClientPurpose).toHaveBeenCalledTimes(1);
  });

  it("should not retry a conflict without a problem body", async () => {
    const conflict = axiosError(eventConflictProblem, null);
    addClientPurpose.mockRejectedValue(conflict);

    await expect(
      clientService.addClientPurpose(clientId, { purposeId }, ctx)
    ).rejects.toBe(conflict);

    expect(addClientPurpose).toHaveBeenCalledTimes(1);
  });

  it("should not retry errors that are not conflicts", async () => {
    addClientPurpose.mockRejectedValue(new Error("network error"));

    await expect(
      clientService.addClientPurpose(clientId, { purposeId }, ctx)
    ).rejects.toThrow("network error");

    expect(addClientPurpose).toHaveBeenCalledTimes(1);
  });
});
