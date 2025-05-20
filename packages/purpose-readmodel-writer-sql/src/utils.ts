import {
  fromPurposeV1,
  genericInternalError,
  Purpose,
  PurposeV1,
} from "pagopa-interop-models";

export const getPurposeFromMessage = (
  purposeV1: PurposeV1 | undefined
): Purpose => {
  if (!purposeV1) {
    throw genericInternalError("Purpose can't be missing in the event message");
  }
  return fromPurposeV1(purposeV1);
};
