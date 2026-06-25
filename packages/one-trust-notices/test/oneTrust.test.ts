import { vi, describe, it, expect, beforeEach } from "vitest";
import axios from "axios";
import { OneTrustClient } from "../src/services/oneTrust.js";
import { ONE_TRUST_CONNECT_RETRIES } from "../src/utils/consts.js";

vi.mock("axios", async () => {
  const actual = await vi.importActual<typeof import("axios")>("axios");
  return {
    ...actual,
    default: {
      ...actual.default,
      post: vi.fn(),
    },
  };
});

const mockedPost = vi.mocked(axios.post);

// Override the retry delay to 0 so the test runs fast.
vi.mock("pagopa-interop-commons", async () => {
  const actual = await vi.importActual<typeof import("pagopa-interop-commons")>(
    "pagopa-interop-commons"
  );
  const fastRetry = async <T>(
    fn: () => Promise<T>,
    { retries }: { retries: number; delay: number }
  ): Promise<T> => {
    try {
      return await fn();
    } catch (error) {
      if (retries <= 1) {
        throw error;
      }
      return fastRetry(fn, { retries: retries - 1, delay: 0 });
    }
  };
  return { ...actual, retry: fastRetry };
});

describe("OneTrustClient.connect", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it(`should retry ${ONE_TRUST_CONNECT_RETRIES} times and throw if OneTrust keeps returning 503`, async () => {
    mockedPost.mockRejectedValue(
      Object.assign(new Error("Request failed with status code 503"), {
        response: { status: 503 },
      })
    );

    await expect(OneTrustClient.connect()).rejects.toThrow(
      "Error while connecting to OneTrust"
    );
    expect(mockedPost).toHaveBeenCalledTimes(ONE_TRUST_CONNECT_RETRIES);
  });

  it("should return a client when a retry eventually succeeds", async () => {
    mockedPost
      .mockRejectedValueOnce(new Error("Request failed with status code 503"))
      .mockRejectedValueOnce(new Error("Request failed with status code 503"))
      .mockResolvedValueOnce({ data: { access_token: "token-abc" } });

    const client = await OneTrustClient.connect();

    expect(client).toBeInstanceOf(OneTrustClient);
    expect(mockedPost).toHaveBeenCalledTimes(3);
  });
});
