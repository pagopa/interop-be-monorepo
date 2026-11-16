import { retry } from "pagopa-interop-commons";
import { describe, expect, it, vi } from "vitest";

describe("retry", () => {
  it("should retry errors accepted by the retry predicate", async () => {
    const retryableError = new Error("retryable");
    const operation = vi
      .fn()
      .mockRejectedValueOnce(retryableError)
      .mockResolvedValueOnce("success");

    await expect(
      retry(operation, {
        retries: 3,
        delay: 0,
        shouldRetry: (error) => error === retryableError,
      })
    ).resolves.toBe("success");
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it("should immediately rethrow errors rejected by the retry predicate", async () => {
    const nonRetryableError = new Error("non-retryable");
    const operation = vi.fn().mockRejectedValue(nonRetryableError);

    await expect(
      retry(operation, {
        retries: 3,
        delay: 0,
        shouldRetry: () => false,
      })
    ).rejects.toBe(nonRetryableError);
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it("should stop after the configured number of attempts", async () => {
    const retryableError = new Error("retryable");
    const operation = vi.fn().mockRejectedValue(retryableError);

    await expect(
      retry(operation, {
        retries: 3,
        delay: 0,
        shouldRetry: () => true,
      })
    ).rejects.toBe(retryableError);
    expect(operation).toHaveBeenCalledTimes(3);
  });
});
