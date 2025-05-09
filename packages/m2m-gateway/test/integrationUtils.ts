/* eslint-disable @typescript-eslint/ban-types */
import { AxiosError, AxiosResponse } from "axios";
import { expect } from "vitest";
import { PagoPAInteropBeClients } from "../src/clients/clientsProvider.js";
import { delegationServiceBuilder } from "../src/services/delegationService.js";
import { WithMaybeMetadata } from "../src/clients/zodiosWithMetadataPatch.js";
import { tenantServiceBuilder } from "../src/services/tenantService.js";
import { clientServiceBuilder } from "../src/services/clientService.js";
import { m2mTestToken } from "./mockUtils.js";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function mockPollingResponse<T>(
  mockResponse: WithMaybeMetadata<T>,
  respondeAfterNCalls = 1
) {
  let callCount = 1;
  return async (): Promise<WithMaybeMetadata<T>> => {
    if (callCount < respondeAfterNCalls) {
      callCount++;
      const notFound: AxiosError = new AxiosError(
        "Resource not found",
        "404",
        undefined,
        undefined,
        { status: 404 } as AxiosResponse
      );
      return Promise.reject(notFound);
    }
    return Promise.resolve(mockResponse);
  };
}

export function expectApiClientGetToHaveBeenCalledWith({
  mockGet,
  params,
  queries,
}: {
  mockGet: Function;
  params?: Record<string, unknown>;
  queries?: Record<string, unknown>;
}): void {
  expect(mockGet).toHaveBeenCalledWith({
    params,
    queries,
    headers: {
      Authorization: `Bearer ${m2mTestToken}`,
      "X-Correlation-Id": expect.any(String),
      "X-Forwarded-For": undefined,
    },
  });
}

export function expectApiClientPostToHaveBeenCalledWith({
  mockPost,
  body,
  params,
}: {
  mockPost: Function;
  body: Record<string, unknown>;
  params?: Record<string, unknown>;
}): void {
  expect(mockPost).toHaveBeenCalledWith(body, {
    headers: {
      Authorization: `Bearer ${m2mTestToken}`,
      "X-Correlation-Id": expect.any(String),
      "X-Forwarded-For": undefined,
    },
    params,
  });
}

export const mockInteropBeClients = {} as PagoPAInteropBeClients;
export const delegationService = delegationServiceBuilder(mockInteropBeClients);
export const tenantService = tenantServiceBuilder(mockInteropBeClients);
export const clientService = clientServiceBuilder(mockInteropBeClients);
