import { isAxiosError } from "axios";
import { Problem } from "pagopa-interop-models";

// Only the event stream conflict of the given process is transient.
// Other 409 responses are business conflicts and must not be retried.
export const isEventConflictWithCode =
  (eventConflictCode: string) =>
  (error: unknown): boolean =>
    isAxiosError<Problem>(error) &&
    error.response?.status === 409 &&
    error.response.data.errors?.some(
      ({ code }) => code === eventConflictCode
    ) === true;
