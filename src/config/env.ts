export const getEnvVar = (name: string, fallback?: string): string | undefined => {
  const value = process.env[name];
  if (value === undefined || value === "") {
    return fallback;
  }
  return value;
};

export const requireEnvVar = (name: string): string => {
  const value = getEnvVar(name);
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
};

export const getEnvVarNumber = (name: string, fallback?: number): number | undefined => {
  const value = getEnvVar(name);
  if (value === undefined) {
    return fallback;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const getEnvVarBoolean = (name: string, fallback?: boolean): boolean | undefined => {
  const value = getEnvVar(name);
  if (value === undefined) {
    return fallback;
  }
  switch (value.toLowerCase()) {
    case "true":
    case "1":
    case "yes":
      return true;
    case "false":
    case "0":
    case "no":
      return false;
    default:
      return fallback;
  }
};
