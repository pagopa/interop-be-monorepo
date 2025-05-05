import { delegationApi, purposeApi } from "pagopa-interop-api-clients";
import { WithLogger, systemRole, genericLogger } from "pagopa-interop-commons";
import {
  CorrelationId,
  TenantId,
  WithMetadata,
  generateId,
} from "pagopa-interop-models";
import { M2MGatewayAppContext } from "../src/utils/context.js";

export function getMockedApiPurposeVersion(): purposeApi.PurposeVersion {
  return {
    id: generateId(),
    createdAt: new Date().toISOString(),
    dailyCalls: 5000,
    state: "DRAFT",
  };
}

export function getMockedApiPurpose({
  versions,
}: {
  versions?: purposeApi.PurposeVersion[];
} = {}): WithMetadata<purposeApi.Purpose> {
  return {
    data: {
      id: generateId(),
      eserviceId: generateId(),
      consumerId: generateId(),
      versions: versions ?? [getMockedApiPurposeVersion()],
      title: "Purpose 1 - test",
      description: "Test purpose - description",
      createdAt: new Date().toISOString(),
      isFreeOfCharge: true,
      freeOfChargeReason: "test",
      isRiskAnalysisValid: true,
    },
    metadata: {
      version: versions ? versions.length - 1 : 0,
    },
  };
}

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
