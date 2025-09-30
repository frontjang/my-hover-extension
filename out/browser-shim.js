"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports._shimInitialized = void 0;
const globalRef = typeof globalThis === "object" ? globalThis : {};
exports._shimInitialized = typeof globalRef.window !== "undefined";
//# sourceMappingURL=browser-shim.js.map