import { WithLogger, systemRole, genericLogger } from "pagopa-interop-commons";
import { CorrelationId, TenantId, generateId } from "pagopa-interop-models";
import { generateMock } from "@anatine/zod-mock";
import { z } from "zod";
import { M2MGatewayAppContext } from "../src/utils/context.js";

export const m2mTestToken = generateMock(z.string().base64());

export const getMockM2MAdminAppContext = ({
  organizationId,
  serviceName,
}: {
  organizationId?: TenantId;
  serviceName?: string;
} = {}): WithLogger<M2MGatewayAppContext> => {
  const correlationId = generateId<CorrelationId>();
  return {
    authData: {
      systemRole: systemRole.M2M_ADMIN_ROLE,
      organizationId: organizationId || generateId(),
      userId: generateId(),
      clientId: generateId(),
    },
    serviceName: serviceName || generateMock(z.string()),
    spanId: generateId(),
    logger: genericLogger,
    requestTimestamp: Date.now(),
    correlationId,
    headers: {
      "X-Correlation-Id": correlationId,
      Authorization: `Bearer ${m2mTestToken}`,
      "X-Forwarded-For": undefined,
    },
  };
};
