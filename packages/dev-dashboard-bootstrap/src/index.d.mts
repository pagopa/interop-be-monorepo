export declare const nodeEnvironment: "development";

export declare const readPackageEnvironment: (
  packagePath: string,
  packageName: string
) => Record<string, string>;

type RunnablePackage = {
  name: string;
  directory: string;
  port?: number;
};

export declare const discoverRunnablePackages: (
  root: string
) => Promise<RunnablePackage[]>;
