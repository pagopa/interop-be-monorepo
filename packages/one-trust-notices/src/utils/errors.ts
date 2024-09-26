import { AxiosError } from "axios";

export function resolveError(error: unknown): string {
  if (error instanceof AxiosError && error.response) {
    // The request was made and the server responded with a status code
    // that falls out of the range of 2xx
    return `Status: ${error.response.status} - ${error.response.statusText}\n Response data: ${error.response.data}\n Headers: ${error.response.headers}`;
  }

  return (error as Error).message;
}
