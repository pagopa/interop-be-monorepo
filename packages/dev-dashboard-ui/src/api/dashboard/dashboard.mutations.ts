import { useMutation } from "@tanstack/react-query";

import { DashboardService } from "./dashboard.services";

function useRunAction() {
  return useMutation({
    mutationKey: ["dashboard", "action"],
    mutationFn: DashboardService.runAction,
  });
}

function useSavePreset() {
  return useMutation({
    mutationKey: ["dashboard", "save-preset"],
    mutationFn: DashboardService.savePreset,
  });
}

function useDeletePreset() {
  return useMutation({
    mutationKey: ["dashboard", "delete-preset"],
    mutationFn: DashboardService.deletePreset,
  });
}

function useGenerateToken() {
  return useMutation({
    mutationKey: ["dashboard", "token"],
    mutationFn: DashboardService.generateToken,
  });
}

export const DashboardMutations = {
  useRunAction,
  useSavePreset,
  useDeletePreset,
  useGenerateToken,
};
