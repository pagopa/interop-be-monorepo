import { generateMock } from "@anatine/zod-mock";
import { PurposeVersionStamps } from "pagopa-interop-models";

export const getMockPurposeVersionStamps = (): PurposeVersionStamps =>
  generateMock(PurposeVersionStamps);
