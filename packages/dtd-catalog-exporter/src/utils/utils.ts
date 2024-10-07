import {
  AttributeId,
  DescriptorReadModel,
  descriptorState,
  DescriptorState,
  EServiceReadModel,
  genericError,
  TenantId,
} from "pagopa-interop-models";

const activeDescriptorStatesFilter: DescriptorState[] = [
  descriptorState.published,
  descriptorState.suspended,
];

export function getLatestActiveDescriptor(
  eservice: EServiceReadModel
): DescriptorReadModel {
  const descriptor = eservice.descriptors
    .filter((d) => activeDescriptorStatesFilter.includes(d.state))
    .sort((a, b) => Number(a.version) - Number(b.version))
    .at(-1);

  if (!descriptor) {
    throw genericError(`EService ${eservice.id} has no active descriptor`);
  }

  return descriptor;
}

/**
 * Returns all tenants ids inside an array of eservices
 *
 * @param eservices - The array of eservices
 * @returns The array of tenants ids
 */
export function getAllTenantsIds(eservices: EServiceReadModel[]): TenantId[] {
  return Array.from(new Set(eservices.map((eservice) => eservice.producerId)));
}

/**
 * Gets the active descriptor from each eservice and returns all attributes ids inside them
 *
 * @param eservices - The array of eservices
 * @returns The array of attributes ids
 */
export function getAllAttributesIds(
  eservices: EServiceReadModel[]
): AttributeId[] {
  const attributesIds: Set<AttributeId> = new Set();

  eservices.forEach((eservice) => {
    const activeDescriptor = getLatestActiveDescriptor(eservice);

    const { certified, verified, declared } = activeDescriptor.attributes;
    [...certified, ...verified, ...declared].forEach((attributesGroup) => {
      attributesGroup.forEach(({ id }) => attributesIds.add(id));
    });
  });

  return Array.from(attributesIds);
}
