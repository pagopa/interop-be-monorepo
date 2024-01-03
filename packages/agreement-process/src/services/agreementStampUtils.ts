import { utcToZonedTime } from "date-fns-tz";
import { AuthData } from "pagopa-interop-commons";
import { AgreementStamp } from "pagopa-interop-models";

export const createStamp = (authData: AuthData): AgreementStamp => ({
  who: authData.userId,
  when: utcToZonedTime(new Date(), "Etc/UTC"),
});
