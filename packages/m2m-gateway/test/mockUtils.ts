import { delegationApi, tenantApi } from "pagopa-interop-api-clients";
import { WithLogger, systemRole, genericLogger } from "pagopa-interop-commons";
import {
  CorrelationId,
  TenantId,
  WithMetadata,
  generateId,
} from "pagopa-interop-models";
import { generateMock } from "@anatine/zod-mock";
import { z } from "zod";
import { M2MGatewayAppContext } from "../src/utils/context.js";

export function getMockedApiDelegation({
  kind,
  eserviceId,
  delegateId,
}: {
  kind?: delegationApi.DelegationKind;
  eserviceId?: string;
  delegateId?: string;
} = {}): WithMetadata<delegationApi.Delegation> {
  return {
    data: {
      kind: kind ?? delegationApi.DelegationKind.Values.DELEGATED_CONSUMER,
      id: generateId(),
      eserviceId: eserviceId ?? generateId(),
      delegateId: delegateId ?? generateId(),
      delegatorId: generateId(),
      createdAt: new Date().toISOString(),
      state: delegationApi.DelegationState.Values.WAITING_FOR_APPROVAL,
      stamps: {
        submission: {
          who: generateId(),
          when: new Date().toISOString(),
        },
      },
    },
    metadata: {
      version: 0,
    },
  };
}

export function getMockedApiTenant(): WithMetadata<tenantApi.Tenant> {
  return {
    data: {
      id: generateId(),
      attributes: [],
      externalId: {
        origin: "ORIGIN",
        value: "VALUE",
      },
      name: generateMock(z.string()),
      createdAt: new Date().toISOString(),
      kind: tenantApi.TenantKind.Values.GSP,
      mails: [],
      features: [],
    },
    metadata: {
      version: 0,
    },
  };
}

export const m2mTestToken = "test-token";
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
    },
    serviceName: serviceName || "test",
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
