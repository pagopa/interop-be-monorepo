type RequiredKeys<T> = {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  [K in keyof T]-?: {} extends Pick<T, K> ? never : K;
}[keyof T];

type OptionalKeys<T> = {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  [K in keyof T]-?: {} extends Pick<T, K> ? K : never;
}[keyof T];

// Mantiene intatte le obbligatorie e forza l'esplicitezza di undefined sulle opzionali
export type CompleteKeys<T> = {
  [K in RequiredKeys<T>]: T[K];
} & {
  [K in OptionalKeys<T>]-?: T[K] | undefined;
};

export const explicitPropertiesChecker = <T extends object>(
  value: CompleteKeys<T>
): CompleteKeys<T> => value;
