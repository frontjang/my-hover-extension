/// <reference types="node" />

declare module "undici" {
  export class Agent {
    constructor(options?: {
      connect?: {
        ca?: string | Buffer | Array<string | Buffer>;
        rejectUnauthorized?: boolean;
      };
    });
  }

  export function setGlobalDispatcher(dispatcher: unknown): void;
}
