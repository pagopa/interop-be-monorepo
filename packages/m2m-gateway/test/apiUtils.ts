import { AxiosError, AxiosResponse } from "axios";
import { WithMaybeMetadata } from "../src/clients/zodiosWithMetadataPatch.js";
import { expect } from "vitest";

export function mockPollingResponse<T>(
  mockResponse: WithMaybeMetadata<T>,
  respondeAfterNCalls = 1
) {
  let callCount = 1;
  return async () => {
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
  params: Object;
  token: string;
}) {
  expect(mockGet).toHaveBeenCalledWith({
    params: params,
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
  body: Object;
  token: string;
}) {
  expect(mockPost).toHaveBeenCalledWith(body, {
    headers: {
      Authorization: `Bearer ${token}`,
      "X-Correlation-Id": expect.any(String),
      "X-Forwarded-For": undefined,
    },
  });
}
