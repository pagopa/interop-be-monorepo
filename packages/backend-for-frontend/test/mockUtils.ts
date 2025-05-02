import { bffApi } from "pagopa-interop-api-clients";
import { DescriptorId, EServiceId, generateId } from "pagopa-interop-models";
// export const getMockApiAgreementListEntry = (): bffApi.AgreementListEntry => ({
//   id: generateId(),
//   consumer: getMockTenant(),
//   eservice: getMockEService(),
//   canBeUpgraded: false,
//   descriptor: getMockDescriptor(),
//   state: "DRAFT",
// });

// const descriptorToCompactDescriptor = (
//   descriptor: Descriptor
// ): CompactDescriptor => ({
//   id: descriptor.id,
//   audience: descriptor.audience,
//   state: descriptor.state,
//   version: descriptor.version,
// });

export const getMockApiAgreementPayload = (): bffApi.AgreementPayload => ({
  descriptorId: generateId<DescriptorId>(),
  eserviceId: generateId<EServiceId>(),
});

export const getMockApiCreatedResource = (): bffApi.CreatedResource => ({
  id: generateId(),
});

export const getMockApiCompactEServiceLight =
  (): bffApi.CompactEServiceLight => ({
    id: generateId<EServiceId>(),
    name: "name",
  });
