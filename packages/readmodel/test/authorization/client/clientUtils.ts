import { clientReadModelServiceBuilder } from "../../../src/authorization/client/clientReadModelService.js";
import { readModelDB } from "../../utils.js";

export const clientReadModelService =
  clientReadModelServiceBuilder(readModelDB);
