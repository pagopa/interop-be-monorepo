/* eslint-disable @typescript-eslint/no-floating-promises */
import { AuthData, userRole } from "pagopa-interop-commons";
import {
  Descriptor,
  descriptorState,
  EService,
  generateId,
  EServiceId,
  delegationState,
  delegationKind,
} from "pagopa-interop-models";
import { expect, describe, it } from "vitest";
import {
  getMockAuthData,
  getMockContext,
  getMockDelegation,
  getMockDescriptor,
  getMockDocument,
  getMockEService,
} from "pagopa-interop-commons-test";
import {
  addOneDelegation,
  addOneEService,
  catalogService,
} from "../integrationUtils.js";
import { eServiceNotFound } from "../../src/model/domain/errors.js";
import { getContextsAllowedToSeeInactiveDescriptors } from "../mockUtils.js";

describe("get eservice by id", () => {
  const mockDescriptor = getMockDescriptor();
  const mockEService = getMockEService();
  const mockDocument = getMockDocument();
  it("should get the eservice if it exists (requester is the producer, admin)", async () => {
    const descriptor1: Descriptor = {
      ...getMockDescriptor(),
      interface: getMockDocument(),
      state: descriptorState.published,
    };
    const eservice1: EService = {
      ...getMockEService(),
      id: generateId(),
      name: "eservice 001",
      descriptors: [descriptor1],
      isSignalHubEnabled: true,
      isConsumerDelegable: true,
      isClientAccessDelegable: true,
    };
    await addOneEService(eservice1);
    const authData: AuthData = {
      ...getMockAuthData(eservice1.producerId),
      userRoles: [userRole.ADMIN_ROLE],
    };

    const descriptor2: Descriptor = {
      ...getMockDescriptor(),
      interface: getMockDocument(),
      state: descriptorState.published,
    };
    const eservice2: EService = {
      ...getMockEService(),
      id: generateId(),
      name: "eservice 002",
      descriptors: [descriptor2],
    };
    await addOneEService(eservice2);

    const descriptor3: Descriptor = {
      ...getMockDescriptor(),
      interface: getMockDocument(),
      state: descriptorState.published,
    };
    const eservice3: EService = {
      ...getMockEService(),
      id: generateId(),
      name: "eservice 003",
      descriptors: [descriptor3],
    };
    await addOneEService(eservice3);

    const result = await catalogService.getEServiceById(
      eservice1.id,
      getMockContext({ authData })
    );
    expect(result).toStrictEqual({
      data: eservice1,
      metadata: { version: 0 },
    });
  });

  it("should throw eServiceNotFound if the eservice doesn't exist", async () => {
    await addOneEService(mockEService);
    const notExistingId: EServiceId = generateId();
    expect(
      catalogService.getEServiceById(notExistingId, getMockContext({}))
    ).rejects.toThrowError(eServiceNotFound(notExistingId));
  });

  it.each([descriptorState.draft, descriptorState.waitingForApproval])(
    "should throw eServiceNotFound if there is only a %s descriptor (requester is not the producer)",
    async (state) => {
      const descriptor = {
        ...mockDescriptor,
        state,
      };
      const eservice: EService = {
        ...mockEService,
        descriptors: [descriptor],
      };
      await addOneEService(mockEService);
      expect(
        catalogService.getEServiceById(eservice.id, getMockContext({}))
      ).rejects.toThrowError(eServiceNotFound(eservice.id));
    }
  );
  it.each([descriptorState.draft, descriptorState.waitingForApproval])(
    "should throw eServiceNotFound if there is only a %s descriptor (requester is the producer, but user role is 'security')",
    async (state) => {
      const descriptor = {
        ...mockDescriptor,
        state,
      };
      const eservice: EService = {
        ...mockEService,
        descriptors: [descriptor],
      };
      const authData: AuthData = {
        ...getMockAuthData(),
        userRoles: [userRole.SECURITY_ROLE],
      };
      await addOneEService(mockEService);
      expect(
        catalogService.getEServiceById(
          eservice.id,
          getMockContext({ authData })
        )
      ).rejects.toThrowError(eServiceNotFound(eservice.id));
    }
  );

  it("should throw eServiceNotFound if there are no descriptors (requester is not the producer)", async () => {
    const eservice: EService = {
      ...mockEService,
      descriptors: [],
    };
    await addOneEService(mockEService);
    expect(
      catalogService.getEServiceById(eservice.id, getMockContext({}))
    ).rejects.toThrowError(eServiceNotFound(eservice.id));
  });

  it("should throw eServiceNotFound if there are no descriptors (requester is the producer, but user role is 'security')", async () => {
    const descriptor = {
      ...mockDescriptor,
      state: descriptorState.draft,
    };
    const eservice: EService = {
      ...mockEService,
      descriptors: [descriptor],
    };
    const authData: AuthData = {
      ...getMockAuthData(eservice.producerId),
      userRoles: [userRole.SECURITY_ROLE],
    };
    await addOneEService(mockEService);
    expect(
      catalogService.getEServiceById(eservice.id, getMockContext({ authData }))
    ).rejects.toThrowError(eServiceNotFound(eservice.id));
  });

  describe.each([descriptorState.draft, descriptorState.waitingForApproval])(
    "should filter out the %s descriptors",
    (state) => {
      it.each(getContextsAllowedToSeeInactiveDescriptors(generateId()))(
        "if the eservice has both of that state and not (requester is not the producer, user roles: $authData.userRoles, system role: $authData.systemRole)",
        async (context) => {
          const descriptorA: Descriptor = {
            ...getMockDescriptor(),
            version: "1",
            state,
          };
          const descriptorB: Descriptor = {
            ...getMockDescriptor(),
            version: "2",
            state: descriptorState.published,
            interface: mockDocument,
            publishedAt: new Date(),
          };
          const eservice: EService = {
            ...mockEService,
            descriptors: [descriptorA, descriptorB],
          };
          await addOneEService(eservice);
          const result = await catalogService.getEServiceById(
            eservice.id,
            context
          );
          expect(result.data.descriptors).toEqual([descriptorB]);
        }
      );
    }
  );

  describe.each([descriptorState.draft, descriptorState.waitingForApproval])(
    "should filter out the %s descriptors",
    async (state) => {
      it("if the eservice has both of that state and not (requester is the producer, but user role is 'security')", async () => {
        const descriptorA: Descriptor = {
          ...getMockDescriptor(),
          version: "1",
          state,
        };
        const descriptorB: Descriptor = {
          ...getMockDescriptor(),
          version: "2",
          state: descriptorState.published,
          interface: mockDocument,
          publishedAt: new Date(),
        };
        const eservice: EService = {
          ...mockEService,
          descriptors: [descriptorA, descriptorB],
        };
        const authData: AuthData = {
          ...getMockAuthData(eservice.producerId),
          userRoles: [userRole.SECURITY_ROLE],
        };
        await addOneEService(eservice);
        const result = await catalogService.getEServiceById(
          eservice.id,
          getMockContext({ authData })
        );
        expect(result.data.descriptors).toEqual([descriptorB]);
      });

      it("if the eservice has both of that state and not (requester is delegate, but user role is 'security')", async () => {
        const descriptorA: Descriptor = {
          ...getMockDescriptor(),
          version: "1",
          state,
        };
        const descriptorB: Descriptor = {
          ...getMockDescriptor(),
          version: "2",
          state: descriptorState.published,
          interface: mockDocument,
          publishedAt: new Date(),
        };
        const eservice: EService = {
          ...mockEService,
          descriptors: [descriptorA, descriptorB],
        };
        const authData: AuthData = {
          ...getMockAuthData(),
          userRoles: [userRole.SECURITY_ROLE],
        };
        const delegation = getMockDelegation({
          kind: delegationKind.delegatedProducer,
          delegateId: authData.organizationId,
          eserviceId: eservice.id,
          state: delegationState.active,
        });
        await addOneDelegation(delegation);
        await addOneEService(eservice);
        const result = await catalogService.getEServiceById(
          eservice.id,
          getMockContext({ authData })
        );
        expect(result.data.descriptors).toEqual([descriptorB]);
      });
    }
  );

  describe.each([descriptorState.draft, descriptorState.waitingForApproval])(
    "should not filter out the %s descriptors",
    (state) => {
      it.each(getContextsAllowedToSeeInactiveDescriptors(generateId()))(
        "if the eservice has both of that state and not (requester is producer, user roles: $authData.userRoles, system role: $authData.systemRole)",
        async (context) => {
          const descriptorA: Descriptor = {
            ...getMockDescriptor(),
            version: "1",
            state,
          };
          const descriptorB: Descriptor = {
            ...getMockDescriptor(),
            version: "2",
            state: descriptorState.published,
            interface: mockDocument,
            publishedAt: new Date(),
          };
          const eservice: EService = {
            ...mockEService,
            producerId: context.authData.organizationId,
            descriptors: [descriptorA, descriptorB],
          };
          await addOneEService(eservice);
          const result = await catalogService.getEServiceById(
            eservice.id,
            context
          );
          expect(result.data.descriptors).toEqual([descriptorA, descriptorB]);
        }
      );

      it.each(getContextsAllowedToSeeInactiveDescriptors(generateId()))(
        "if the eservice has both of that state and not (requester is delegate, user roles: $authData.userRoles, system role: $authData.systemRole)",
        async (context) => {
          const descriptorA: Descriptor = {
            ...getMockDescriptor(),
            version: "1",
            state,
          };
          const descriptorB: Descriptor = {
            ...getMockDescriptor(),
            version: "2",
            state: descriptorState.published,
            interface: mockDocument,
            publishedAt: new Date(),
          };
          const eservice: EService = {
            ...mockEService,
            descriptors: [descriptorA, descriptorB],
          };
          const delegation = getMockDelegation({
            kind: delegationKind.delegatedProducer,
            delegateId: context.authData.organizationId,
            eserviceId: eservice.id,
            state: delegationState.active,
          });
          await addOneEService(eservice);
          await addOneDelegation(delegation);
          const result = await catalogService.getEServiceById(
            eservice.id,
            context
          );
          expect(result.data.descriptors).toEqual([descriptorA, descriptorB]);
        }
      );
    }
  );
});
