export type OperationStep = {
  id: string;
  label: string;
  concurrent?: boolean;
  run: () => Promise<boolean>;
};
