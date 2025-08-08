import { it, expect, vi, beforeEach, beforeAll } from "vitest";

vi.mock("../src/config/config.js", () => ({
  config: {
    awsRegion: "eu-central-1",
    s3Bucket: "test-bucket",
  },
}));

const mockS3Send = vi.fn();
vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: vi.fn(() => ({
    send: mockS3Send,
  })),
  PutObjectCommand: vi.fn((params) => params),
}));

// eslint-disable-next-line functional/no-let
let persistToS3: typeof import("../src/services/s3Service.js").persistToS3;

beforeAll(async () => {
  const s3Module = await import("../src/services/s3Service.js");
  persistToS3 = s3Module.persistToS3;
});

beforeEach(() => {
  vi.clearAllMocks();
});

it("should persist in S3", async () => {
  const testPayload = { id: "test-id-123" };
  const mockDate = 1672531200000;

  const mockLogger = {
    isDebugEnabled: (): boolean => true,
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  };

  vi.useFakeTimers();
  vi.setSystemTime(mockDate);

  await persistToS3(testPayload, mockLogger);

  expect(mockS3Send).toHaveBeenCalledTimes(1);

  const calledWith = mockS3Send.mock.calls[0][0];
  expect(calledWith.Bucket).toBe("test-bucket");
  expect(calledWith.Key).toBe(
    `signed-objects/${mockDate}-${testPayload.id}.json`
  );
  expect(calledWith.Body).toBe(JSON.stringify(testPayload));
  expect(calledWith.ContentType).toBe("application/json");

  vi.useRealTimers();
});
