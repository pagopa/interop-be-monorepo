import type { AxiosRequestConfig, AxiosResponse } from "axios";
import type { ZodType } from "zod";

import { isAxiosError } from "axios";
import { schemas } from "pagopa-interop-dev-dashboard-contracts";

import axiosInstance from "../config/axios";

const invalidResponseMessage =
  "The dashboard received an invalid API response. Refresh or check the API logs.";

export async function request<T>(
  path: string,
  schema: ZodType<T>,
  config?: AxiosRequestConfig<unknown>
): Promise<T> {
  let response: AxiosResponse<unknown>;
  try {
    // Decode JSON at this boundary so malformed bodies cannot pass a permissive schema.
    response = await axiosInstance.request<unknown>({
      ...config,
      url: path,
      responseType: "text",
    });
  } catch (error) {
    if (!isAxiosError<unknown>(error) || !error.response) throw error;
    let body: unknown;
    try {
      body =
        typeof error.response.data === "string"
          ? JSON.parse(error.response.data)
          : error.response.data;
    } catch {
      // Non-JSON HTTP failures expose only their status, never raw upstream text.
    }
    const failure = schemas.ApiError.safeParse(body);
    throw new Error(
      failure.success
        ? failure.data.error
        : `Request failed (${error.response.status}).`
    );
  }
  let body: unknown;
  try {
    body =
      response.status === 204
        ? undefined
        : typeof response.data === "string"
          ? JSON.parse(response.data)
          : response.data;
  } catch {
    throw new Error(invalidResponseMessage);
  }
  const result = schema.safeParse(body);
  if (!result.success) throw new Error(invalidResponseMessage);
  return result.data;
}
