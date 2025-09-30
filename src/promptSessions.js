let lastSession;

function recordPromptSession(session) {
  lastSession = session;
}

function getLastPromptSession() {
  return lastSession;
}

module.exports = {
  recordPromptSession,
  getLastPromptSession
};
