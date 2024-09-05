import {
  ClientId,
  DescriptorId,
  EServiceId,
  generateId,
  makeGSIPKEServiceIdDescriptorId,
  makePlatformStatesEServiceDescriptorPK,
  makeTokenGenerationStatesClientKidPK,
} from "pagopa-interop-models";
import { describe, expect, it } from "vitest";

describe("test", () => {
  it("makePlatformStatesEServiceDescriptorPK", () => {
    const eserviceId = generateId<EServiceId>();
    const descriptorId = generateId<DescriptorId>();
    const PK = makePlatformStatesEServiceDescriptorPK({
      eserviceId,
      descriptorId,
    });
    expect(PK).toEqual(`ESERVICEDESCRIPTOR#${eserviceId}#${descriptorId}`);
  });

  it("makeGSIPKEServiceIdDescriptorId", () => {
    const eserviceId = generateId<EServiceId>();
    const descriptorId = generateId<DescriptorId>();
    const GSI = makeGSIPKEServiceIdDescriptorId({
      eserviceId,
      descriptorId,
    });
    expect(GSI).toEqual(`${eserviceId}#${descriptorId}`);
  });

  it("makeTokenGenerationStatesClientKidPK", () => {
    const clientId = generateId<ClientId>();
    const kid = `kid ${Math.random()}`;
    const GSI = makeTokenGenerationStatesClientKidPK({
      clientId,
      kid,
    });
    expect(GSI).toEqual(`CLIENTKID#${clientId}#${kid}`);
  });
});
