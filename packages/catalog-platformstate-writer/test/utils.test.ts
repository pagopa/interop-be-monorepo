import {
  DescriptorId,
  EServiceId,
  generateId,
  makePlatformStatesEServiceDescriptorPK,
} from "pagopa-interop-models";
import { describe, expect, it } from "vitest";

describe("test", () => {
  it("makePlatformStatesEServiceDescriptorPK", () => {
    const eserviceId = generateId<EServiceId>();
    const descriptorId = generateId<DescriptorId>();
    const PK = makePlatformStatesEServiceDescriptorPK(eserviceId, descriptorId);
    expect(PK).toEqual(`ESERVICEDESCRIPTOR#${eserviceId}#${descriptorId}`);
  });
});
