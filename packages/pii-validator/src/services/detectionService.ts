import { DetectionRequest, DetectionResponse } from "../model/contracts.js";
import { detectCategories } from "./recognizers.js";

export interface DetectionService {
  detect(request: DetectionRequest): Promise<DetectionResponse>;
}

export const detectionService: DetectionService = {
  async detect(request): Promise<DetectionResponse> {
    return {
      results: request.fields.map(({ fieldId, text }) => ({
        fieldId,
        detectedCategories: text === "" ? [] : detectCategories(text),
      })),
    };
  },
};
