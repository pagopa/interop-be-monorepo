import { AxiosError, InternalAxiosRequestConfig } from "axios";
import { genericLogger, WithLogger } from "pagopa-interop-commons";
import { getMockAuthData, getMockContext } from "pagopa-interop-commons-test";
import {
  ClientId,
  commonErrorCodes,
  generateId,
  Problem,
  PurposeId,
  serviceErrorCode,
  serviceName,
} from "pagopa-interop-models";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PagoPAInteropBeClients } from "../src/clients/clientsProvider.js";
import { clientServiceBuilder } from "../src/services/clientService.js";
import { BffAppContext } from "../src/utilities/context.js";

describe("addClientPurpose", () => {
  const clientId = generateId<ClientId>();
  const purposeId = generateId<PurposeId>();
  const appContext = getMockContext({ authData: getMockAuthData() });
  const ctx: WithLogger<BffAppContext> = {
    ...appContext,
    headers: {
      "X-Correlation-Id": appContext.correlationId,
      Authorization: "authorization",
      "X-Forwarded-For": "x-forwarded-for",
    },
    logger: genericLogger,
  };

  const addClientPurpose = vi.fn();
  const mockClients = {
    authorizationClient: {
      client: {
        addClientPurpose,
      },
    },
    selfcareV2UserClient: {},
    inAppNotificationManagerClient: {},
  } as unknown as PagoPAInteropBeClients;

  const clientService = clientServiceBuilder(mockClients);

  const axiosError = (problem: Problem): AxiosError<Problem> =>
    new AxiosError(
      "Downstream error",
      String(problem.status),
      undefined,
      undefined,
      {
        status: problem.status,
        data: problem,
        statusText: problem.title,
        config: {} as InternalAxiosRequestConfig,
        headers: {},
      }
    );

  const eventConflictProblem: Problem = {
    type: "about:blank",
    title: "Conflict",
    status: 409,
    detail: "Request conflicts with an ongoing operation. Please retry.",
    correlationId: ctx.correlationId,
    errors: [
      {
        code: `${serviceErrorCode[serviceName.AUTHORIZATION_PROCESS]}-${commonErrorCodes.eventConflictError}`,
        detail: "Request conflicts with an ongoing operation. Please retry.",
      },
    ],
  };

  beforeEach(() => {
    addClientPurpose.mockReset();
  });

  it("should retry authorization event conflicts and complete the association", async () => {
    addClientPurpose
      .mockRejectedValueOnce(axiosError(eventConflictProblem))
      .mockResolvedValueOnce(undefined);

    await expect(
      clientService.addClientPurpose(clientId, { purposeId }, ctx)
    ).resolves.toBeUndefined();

    expect(addClientPurpose).toHaveBeenCalledTimes(2);
    expect(addClientPurpose).toHaveBeenCalledWith(
      { purposeId },
      { params: { clientId }, headers: ctx.headers }
    );
  });

  it("should not retry other conflicts", async () => {
    const purposeAlreadyLinked: Problem = {
      ...eventConflictProblem,
      errors: [{ code: "006-0008", detail: "Purpose already linked" }],
    };
    addClientPurpose.mockRejectedValue(axiosError(purposeAlreadyLinked));

    await expect(
      clientService.addClientPurpose(clientId, { purposeId }, ctx)
    ).rejects.toBeInstanceOf(AxiosError);

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
