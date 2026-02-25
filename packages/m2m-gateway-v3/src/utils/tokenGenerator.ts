import { InteropTokenGenerator } from "pagopa-interop-commons";
import { config } from "../config/config.js";

export function getIntoropTokenGenerator(): InteropTokenGenerator {
  return new InteropTokenGenerator(config);
}
