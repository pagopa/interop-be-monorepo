export type OperationStep = {
  id: string;
  label: string;
  run: () => Promise<boolean>;
};
