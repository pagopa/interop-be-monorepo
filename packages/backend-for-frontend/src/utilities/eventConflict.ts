import { isAxiosError } from "axios";
import { constants } from "http2";
import { retry } from "pagopa-interop-commons";
import { Problem } from "pagopa-interop-models";

import {
  EVENT_CONFLICT_MAX_ATTEMPTS,
  EVENT_CONFLICT_RETRY_DELAY_MS,
} from "../config/constants.js";

const { HTTP_STATUS_CONFLICT } = constants;

// Only the event stream conflict of the given process is transient.
// Other 409 responses are business conflicts and must not be retried.
export const isEventConflict = (
  error: unknown,
  eventConflictCode: string
): boolean =>
  isAxiosError<Problem>(error) &&
  error.response?.status === HTTP_STATUS_CONFLICT &&
  error.response.data?.errors?.some(
    ({ code }) => code === eventConflictCode
  ) === true;

// The process rolls back the event insert on a conflict, so the call
// is safe to repeat. Every attempt reads the current resource version.
export const retryOnEventConflict = <T>(
  eventConflictCode: string,
  fn: () => Promise<T>
): Promise<T> =>
  retry(fn, {
    retries: EVENT_CONFLICT_MAX_ATTEMPTS,
    delay: EVENT_CONFLICT_RETRY_DELAY_MS,
    shouldRetry: (error) => isEventConflict(error, eventConflictCode),
  });
