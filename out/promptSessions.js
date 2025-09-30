"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.recordPromptSession = recordPromptSession;
exports.getLastPromptSession = getLastPromptSession;
let lastSession;
function recordPromptSession(session) {
    lastSession = session;
}
function getLastPromptSession() {
    return lastSession;
}
//# sourceMappingURL=promptSessions.js.map