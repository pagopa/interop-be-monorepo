import { generateId, unsafeBrandId } from "pagopa-interop-models";
import { generateMock } from "@anatine/zod-mock";
import { z } from "zod";
import { WithLogger, logger } from "pagopa-interop-commons";
import { M2MGatewayAppContext } from "../src/utils/context.js";
import { DownloadedDocument } from "../src/utils/fileDownload.js";

export const m2mTestToken = generateMock(z.string().base64());

export const getMockM2MAdminAppContext =
  (): WithLogger<M2MGatewayAppContext> => {
    const baseContext: M2MGatewayAppContext = {
      correlationId: unsafeBrandId(generateId()),
      serviceName: "testService",
      authData: {
        systemRole: "m2m-admin" as const,
        organizationId: unsafeBrandId(generateId()),
        userId: unsafeBrandId(generateId()),
        clientId: unsafeBrandId(generateId()),
      },
      spanId: generateId(),
      requestTimestamp: Date.now(),
      headers: {
        "X-Correlation-Id": unsafeBrandId(generateId()),
        Authorization: `Bearer ${m2mTestToken}`,
        "X-Forwarded-For": undefined,
      },
    };
    return {
      ...baseContext,
      logger: logger(baseContext),
    };
  };

export const getMockM2MAppContext = (): WithLogger<M2MGatewayAppContext> => {
  const baseContext: M2MGatewayAppContext = {
    correlationId: unsafeBrandId(generateId()),
    serviceName: "testService",
    authData: {
      systemRole: "m2m" as const,
      organizationId: unsafeBrandId(generateId()),
    },
    spanId: generateId(),
    requestTimestamp: Date.now(),
    headers: {
      "X-Correlation-Id": unsafeBrandId(generateId()),
      Authorization: `Bearer ${m2mTestToken}`,
      "X-Forwarded-For": undefined,
    },
  };
  return {
    ...baseContext,
    logger: logger(baseContext),
  };
};

export function getMockDownloadedDocument({
  mockFileName = "mockFileName.txt",
  mockContentType = "text/plain",
  mockFileContent = "This is a mock file content for testing purposes.\nIt simulates the content of an Eservice descriptor interface file.\nOn multiple lines.",
  prettyName = "Mock File Name",
  id = generateId(),
}: {
  id?: string;
  mockFileName?: string;
  mockContentType?: string;
  mockFileContent?: string;
  prettyName?: string;
} = {}): DownloadedDocument {
  return {
    id,
    file: new File([Buffer.from(mockFileContent)], mockFileName, {
      type: mockContentType,
    }),
    prettyName,
  };
}
