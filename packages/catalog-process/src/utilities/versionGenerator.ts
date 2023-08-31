import { z } from "zod";
import { EService } from "pagopa-interop-models";
import { CatalogProcessError, ErrorTypes } from "../model/domain/errors.js";

export const nextDescriptorVersion = (eservice: EService): string => {
  const currentVersion = eservice.descriptors.reduce((max, descriptor) => {
    const currentVersionNumber = z.coerce
      .number()
      .safeParse(descriptor.version);
    if (!currentVersionNumber.success) {
      throw new CatalogProcessError(
        `${descriptor.version} is not a valid descriptor version`,
        ErrorTypes.InvalidDescriptorVersion
      );
    }

    return currentVersionNumber.data > max ? currentVersionNumber.data : max;
  }, 0);

  return currentVersion.toString();
};
