import { DetectionRequest, DetectionResponse } from "../model/contracts.js";
import { detectionNotImplemented } from "../model/errors.js";

export interface DetectionService {
  detect(request: DetectionRequest): Promise<DetectionResponse>;
}

export const detectionService: DetectionService = {
  async detect(_request): Promise<DetectionResponse> {
    throw detectionNotImplemented();
  },
};
