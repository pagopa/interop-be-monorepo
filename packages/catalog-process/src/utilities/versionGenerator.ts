import { Descriptor, EService } from "pagopa-interop-models";
import { z } from "zod";
import { invalidDescriptorVersion } from "../model/domain/errors.js";

function parseVersionNumber(version: string): number {
  const versionNumber = z.coerce.number().safeParse(version);
  if (!versionNumber.success) {
    throw invalidDescriptorVersion(
      `${version} is not a valid descriptor version`
    );
  }
  return versionNumber.data;
}

export const getLatestDescriptor = (
  eservice: EService
): Descriptor | undefined =>
  eservice.descriptors.length > 0
    ? eservice.descriptors.reduce(
        (latest, descriptor) =>
          parseVersionNumber(descriptor.version) >
          parseVersionNumber(latest.version)
            ? descriptor
            : latest,
        eservice.descriptors[0]
      )
    : undefined;

export const nextDescriptorVersion = (eservice: EService): string => {
  const currentVersion = getLatestDescriptor(eservice)?.version ?? "0";
  const parsedVersion = parseVersionNumber(currentVersion);
  return (parsedVersion + 1).toString();
};
