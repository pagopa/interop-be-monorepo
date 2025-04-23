/* eslint-disable @typescript-eslint/ban-types */
import { AxiosError, AxiosResponse } from "axios";
import { expect } from "vitest";
import { PagoPAInteropBeClients } from "../src/clients/clientsProvider.js";
import { delegationServiceBuilder } from "../src/services/delegationService.js";
import { WithMaybeMetadata } from "../src/clients/zodiosWithMetadataPatch.js";

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
  token,
}: {
  mockGet: Function;
  params: Record<string, unknown>;
  token: string;
}): void {
  expect(mockGet).toHaveBeenCalledWith({
    params,
    headers: {
      Authorization: `Bearer ${token}`,
      "X-Correlation-Id": expect.any(String),
      "X-Forwarded-For": undefined,
    },
  });
}

export function expectApiClientPostToHaveBeenCalledWith({
  mockPost,
  body,
  token,
}: {
  mockPost: Function;
  body: Record<string, unknown>;
  token: string;
}): void {
  expect(mockPost).toHaveBeenCalledWith(body, {
    headers: {
      Authorization: `Bearer ${token}`,
      "X-Correlation-Id": expect.any(String),
      "X-Forwarded-For": undefined,
    },
  });
}

export const mockInteropBeClients = {} as PagoPAInteropBeClients;
export const delegationService = delegationServiceBuilder(mockInteropBeClients);
