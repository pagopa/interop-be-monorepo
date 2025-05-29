/* eslint-disable @typescript-eslint/ban-types */
import { AxiosError, AxiosResponse } from "axios";
import { expect } from "vitest";
import { PagoPAInteropBeClients } from "../src/clients/clientsProvider.js";
import { delegationServiceBuilder } from "../src/services/delegationService.js";
import { WithMaybeMetadata } from "../src/clients/zodiosWithMetadataPatch.js";
import { purposeServiceBuilder } from "../src/services/purposeService.js";
import { tenantServiceBuilder } from "../src/services/tenantService.js";
import { attributeServiceBuilder } from "../src/services/attributeService.js";
import { clientServiceBuilder } from "../src/services/clientService.js";
import { eserviceTemplateServiceBuilder } from "../src/services/eserviceTemplateService.js";
import { agreementServiceBuilder } from "../src/services/agreementService.js";
import { eserviceServiceBuilder } from "../src/services/eserviceService.js";
import { keyServiceBuilder } from "../src/services/keyService.js";
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

export function expectApiClientGetToHaveBeenNthCalledWith({
  nthCall,
  mockGet,
  params,
  queries,
}: {
  nthCall: number;
  mockGet: Function;
  params?: Record<string, unknown>;
  queries?: Record<string, unknown>;
}): void {
  expect(mockGet).toHaveBeenNthCalledWith(nthCall, {
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
  queries,
}: {
  mockPost: Function;
  body?: Record<string, unknown> | unknown[];
  params?: Record<string, unknown>;
  queries?: Record<string, unknown>;
}): void {
  expect(mockPost).toHaveBeenCalledWith(body ?? undefined, {
    params,
    queries,
    headers: {
      Authorization: `Bearer ${m2mTestToken}`,
      "X-Correlation-Id": expect.any(String),
      "X-Forwarded-For": undefined,
    },
  });
}

export const mockInteropBeClients = {} as PagoPAInteropBeClients;

export const delegationService = delegationServiceBuilder(mockInteropBeClients);
export const purposeService = purposeServiceBuilder(mockInteropBeClients);
export const tenantService = tenantServiceBuilder(mockInteropBeClients);
export const attributeService = attributeServiceBuilder(mockInteropBeClients);
export const eserviceTemplateService =
  eserviceTemplateServiceBuilder(mockInteropBeClients);
export const clientService = clientServiceBuilder(mockInteropBeClients);
export const agreementService = agreementServiceBuilder(mockInteropBeClients);
export const eserviceService = eserviceServiceBuilder(mockInteropBeClients);
export const keyService = keyServiceBuilder(mockInteropBeClients);
