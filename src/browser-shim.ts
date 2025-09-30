const globalRef = typeof globalThis === "object" ? (globalThis as Record<string, unknown>) : {};
export const _shimInitialized = typeof globalRef.window !== "undefined";
