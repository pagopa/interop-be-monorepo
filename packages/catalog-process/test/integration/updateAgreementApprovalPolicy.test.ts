/* eslint-disable @typescript-eslint/no-floating-promises */
import {
  decodeProtobufPayload,
  getMockAuthData,
  getMockContext,
  getMockDelegation,
  getMockDescriptor,
  getMockDocument,
  getMockEService,
} from "pagopa-interop-commons-test";
import {
  Descriptor,
  descriptorState,
  EService,
  toEServiceV2,
  operationForbidden,
  agreementApprovalPolicy,
  EServiceDescriptorAgreementApprovalPolicyUpdatedV2,
  featureFlagNotEnabled,
  delegationKind,
  delegationState,
} from "pagopa-interop-models";
import { catalogApi } from "pagopa-interop-api-clients";
import { expect, describe, it, beforeEach } from "vitest";
import {
  eServiceNotFound,
  eServiceDescriptorNotFound,
  notValidDescriptorState,
} from "../../src/model/domain/errors.js";
import { config } from "../../src/config/config.js";
import {
  addOneEService,
  catalogService,
  readLastEserviceEvent,
  addOneDelegation,
} from "../integrationUtils.js";

describe("update descriptor agreement approval policy", () => {
  const mockEService = getMockEService();
  const mockDescriptor = getMockDescriptor();
  const mockDocument = getMockDocument();
  beforeEach(() => {
    config.featureFlagAgreementApprovalPolicyUpdate = true;
  });
  it.each([
    descriptorState.published,
    descriptorState.suspended,
    descriptorState.deprecated,
  ])(
    "should write on event-store for the update of descriptor agreement approval policy in state %s",
    async (state) => {
      const descriptor: Descriptor = {
        ...mockDescriptor,
        agreementApprovalPolicy: agreementApprovalPolicy.automatic,
        state,
        interface: mockDocument,
        publishedAt: new Date(),
      };
      const eservice: EService = {
        ...mockEService,
        descriptors: [descriptor],
      };
      await addOneEService(eservice);

      const updatedDescriptorAgreementApprovalPolicy: catalogApi.UpdateEServiceDescriptorAgreementApprovalPolicySeed =
        {
          agreementApprovalPolicy: "MANUAL",
        };

      const updatedEService: EService = {
        ...eservice,
        descriptors: [
          {
            ...descriptor,
            agreementApprovalPolicy: agreementApprovalPolicy.manual,
          },
        ],
      };
      const returnedEService =
        await catalogService.updateAgreementApprovalPolicy(
          eservice.id,
          descriptor.id,
          updatedDescriptorAgreementApprovalPolicy,
          getMockContext({ authData: getMockAuthData(eservice.producerId) })
        );
      const writtenEvent = await readLastEserviceEvent(eservice.id);
      expect(writtenEvent).toMatchObject({
        stream_id: eservice.id,
        version: "1",
        type: "EServiceDescriptorAgreementApprovalPolicyUpdated",
        event_version: 2,
      });
      const writtenPayload = decodeProtobufPayload({
        messageType: EServiceDescriptorAgreementApprovalPolicyUpdatedV2,
        payload: writtenEvent.data,
      });
      expect(writtenPayload.eservice).toEqual(toEServiceV2(updatedEService));
      expect(writtenPayload.eservice).toEqual(toEServiceV2(returnedEService));
    }
  );

  it.each([
    descriptorState.published,
    descriptorState.suspended,
    descriptorState.deprecated,
  ])(
    "should write on event-store for the update of descriptor agreement approval policy in state %s as delegate",
    async (state) => {
      const descriptor: Descriptor = {
        ...mockDescriptor,
        agreementApprovalPolicy: agreementApprovalPolicy.automatic,
        state,
        interface: mockDocument,
        publishedAt: new Date(),
      };
      const eservice: EService = {
        ...mockEService,
        descriptors: [descriptor],
      };
      const delegation = getMockDelegation({
        kind: delegationKind.delegatedProducer,
        eserviceId: eservice.id,
        state: delegationState.active,
      });
      await addOneEService(eservice);
      await addOneDelegation(delegation);

      const updatedDescriptorAgreementApprovalPolicy: catalogApi.UpdateEServiceDescriptorAgreementApprovalPolicySeed =
        {
          agreementApprovalPolicy: "MANUAL",
        };

      const updatedEService: EService = {
        ...eservice,
        descriptors: [
          {
            ...descriptor,
            agreementApprovalPolicy: agreementApprovalPolicy.manual,
          },
        ],
      };
      const returnedEService =
        await catalogService.updateAgreementApprovalPolicy(
          eservice.id,
          descriptor.id,
          updatedDescriptorAgreementApprovalPolicy,
          getMockContext({ authData: getMockAuthData(delegation.delegateId) })
        );
      const writtenEvent = await readLastEserviceEvent(eservice.id);
      expect(writtenEvent).toMatchObject({
        stream_id: eservice.id,
        version: "1",
        type: "EServiceDescriptorAgreementApprovalPolicyUpdated",
        event_version: 2,
      });
      const writtenPayload = decodeProtobufPayload({
        messageType: EServiceDescriptorAgreementApprovalPolicyUpdatedV2,
        payload: writtenEvent.data,
      });
      expect(writtenPayload.eservice).toEqual(toEServiceV2(updatedEService));
      expect(writtenPayload.eservice).toEqual(toEServiceV2(returnedEService));
    }
  );

  it("should throw eServiceNotFound if the eservice doesn't exist", () => {
    const updatedDescriptorAgreementApprovalPolicy: catalogApi.UpdateEServiceDescriptorAgreementApprovalPolicySeed =
      {
        agreementApprovalPolicy: "MANUAL",
      };
    expect(
      catalogService.updateAgreementApprovalPolicy(
        mockEService.id,
        mockDescriptor.id,
        updatedDescriptorAgreementApprovalPolicy,
        getMockContext({ authData: getMockAuthData(mockEService.producerId) })
      )
    ).rejects.toThrowError(eServiceNotFound(mockEService.id));
  });

  it("should throw eServiceDescriptorNotFound if the descriptor doesn't exist", async () => {
    const eservice: EService = {
      ...mockEService,
      descriptors: [],
    };
    await addOneEService(eservice);

    const updatedDescriptorAgreementApprovalPolicy: catalogApi.UpdateEServiceDescriptorAgreementApprovalPolicySeed =
      {
        agreementApprovalPolicy: "MANUAL",
      };

    expect(
      catalogService.updateAgreementApprovalPolicy(
        mockEService.id,
        mockDescriptor.id,
        updatedDescriptorAgreementApprovalPolicy,
        getMockContext({ authData: getMockAuthData(mockEService.producerId) })
      )
    ).rejects.toThrowError(
      eServiceDescriptorNotFound(eservice.id, mockDescriptor.id)
    );
  });

  it.each([descriptorState.draft, descriptorState.archived])(
    "should throw notValidDescriptor if the descriptor is in %s state",
    async (state) => {
      const descriptor: Descriptor = {
        ...mockDescriptor,
        interface: mockDocument,
        state,
      };
      const eservice: EService = {
        ...mockEService,
        descriptors: [descriptor],
      };
      await addOneEService(eservice);
      const updatedDescriptorAgreementApprovalPolicy: catalogApi.UpdateEServiceDescriptorAgreementApprovalPolicySeed =
        {
          agreementApprovalPolicy: "MANUAL",
        };

      expect(
        catalogService.updateAgreementApprovalPolicy(
          eservice.id,
          descriptor.id,
          updatedDescriptorAgreementApprovalPolicy,
          getMockContext({ authData: getMockAuthData(mockEService.producerId) })
        )
      ).rejects.toThrowError(notValidDescriptorState(mockDescriptor.id, state));
    }
  );

  it("should throw operationForbidden if the requester is not the producer", async () => {
    const descriptor: Descriptor = {
      ...mockDescriptor,
      state: descriptorState.draft,
    };
    const eservice: EService = {
      ...mockEService,
      descriptors: [descriptor],
    };
    await addOneEService(eservice);

    const updatedDescriptorAgreementApprovalPolicy: catalogApi.UpdateEServiceDescriptorAgreementApprovalPolicySeed =
      {
        agreementApprovalPolicy: "MANUAL",
      };
    expect(
      catalogService.updateAgreementApprovalPolicy(
        eservice.id,
        descriptor.id,
        updatedDescriptorAgreementApprovalPolicy,
        getMockContext({ authData: getMockAuthData() })
      )
    ).rejects.toThrowError(operationForbidden);
  });

  it("should throw featureFlagNotEnabled if the feature flag is not enabled", async () => {
    config.featureFlagAgreementApprovalPolicyUpdate = false;
    await expect(
      catalogService.updateAgreementApprovalPolicy(
        mockEService.id,
        mockDescriptor.id,
        { agreementApprovalPolicy: "MANUAL" },
        getMockContext({ authData: getMockAuthData(mockEService.producerId) })
      )
    ).rejects.toThrowError(
      featureFlagNotEnabled("featureFlagAgreementApprovalPolicyUpdate")
    );
  });
});
