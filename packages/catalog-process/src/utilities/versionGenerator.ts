import { Descriptor, DescriptorState, EService } from "pagopa-interop-models";
import { z } from "zod";
import {
  eserviceWithoutValidDescriptors,
  invalidDescriptorVersion,
} from "../model/domain/errors.js";
import { isActiveDescriptor } from "../services/validators.js";

function parseVersionNumber(version: string): number {
  const versionNumber = z.coerce.number().safeParse(version);
  if (!versionNumber.success) {
    throw invalidDescriptorVersion(
      `${version} is not a valid descriptor version`
    );
  }
  return versionNumber.data;
}

export const getLatestDescriptor = (eservice: EService): Descriptor => {
  const latestDescriptor = [...eservice.descriptors]
    .sort(
      (a, b) => parseVersionNumber(a.version) - parseVersionNumber(b.version)
    )
    .at(-1);
  if (!latestDescriptor) {
    throw eserviceWithoutValidDescriptors(eservice.id);
  }

  return latestDescriptor;
};

export const getLatestDescriptorByStates = (
  eservice: EService,
  states: DescriptorState[]
): Descriptor | undefined =>
  [...eservice.descriptors]
    .filter((d) => states.includes(d.state))
    .sort(
      (a, b) => parseVersionNumber(a.version) - parseVersionNumber(b.version)
    )
    .at(-1);

export const nextDescriptorVersion = (eservice: EService): string => {
  const currentVersion = getLatestDescriptor(eservice)?.version ?? "0";
  const parsedVersion = parseVersionNumber(currentVersion);
  return (parsedVersion + 1).toString();
};

export function isLatestActiveDescriptorVersion(
  target: Descriptor,
  allDescriptors: Descriptor[]
): boolean {
  const versions = allDescriptors
    .filter(isActiveDescriptor)
    .map((d) => parseInt(d.version, 10));

  if (versions.length === 0) {
    return false;
  }

  const maxVersion = Math.max(...versions);
  return parseInt(target.version, 10) === maxVersion;
}
