/* eslint-disable @typescript-eslint/no-floating-promises */
import { genericLogger } from "pagopa-interop-commons";
import { decodeProtobufPayload } from "pagopa-interop-commons-test/index.js";
import {
  Descriptor,
  descriptorState,
  EService,
  toEServiceV2,
  operationForbidden,
  generateId,
  agreementApprovalPolicy,
  EServiceDescriptorAgreementApprovalPolicyUpdatedV2,
} from "pagopa-interop-models";
import { catalogApi } from "pagopa-interop-api-clients";
import { expect, describe, it } from "vitest";
import {
  eServiceNotFound,
  eServiceDescriptorNotFound,
  notValidDescriptor,
} from "../src/model/domain/errors.js";
import {
  addOneEService,
  catalogService,
  getMockAuthData,
  getMockDescriptor,
  getMockDocument,
  getMockEService,
  readLastEserviceEvent,
} from "./utils.js";

describe("update descriptor agreement approval policy", () => {
  const mockEService = getMockEService();
  const mockDescriptor = getMockDescriptor();
  const mockDocument = getMockDocument();
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
          {
            authData: getMockAuthData(eservice.producerId),
            correlationId: generateId(),
            serviceName: "",
            logger: genericLogger,
          }
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
        {
          authData: getMockAuthData(mockEService.producerId),
          correlationId: generateId(),
          serviceName: "",
          logger: genericLogger,
        }
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
        {
          authData: getMockAuthData(mockEService.producerId),
          correlationId: generateId(),
          serviceName: "",
          logger: genericLogger,
        }
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
          {
            authData: getMockAuthData(eservice.producerId),
            correlationId: generateId(),
            serviceName: "",
            logger: genericLogger,
          }
        )
      ).rejects.toThrowError(notValidDescriptor(mockDescriptor.id, state));
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
        {
          authData: getMockAuthData(),
          correlationId: generateId(),
          serviceName: "",
          logger: genericLogger,
        }
      )
    ).rejects.toThrowError(operationForbidden);
  });
});
