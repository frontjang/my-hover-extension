"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert = require("assert");
const fs_1 = require("fs");
const Module = require("module");
const path_1 = require("path");
const customAiDebug_1 = require("../../ai/customAiDebug");
const ensureEnv = (key, value) => {
    if (!process.env[key]) {
        process.env[key] = value;
    }
};
const moduleRuntime = Module;
const originalModuleLoad = moduleRuntime._load;
const moduleLoadPatchedFlag = Symbol.for('customai.test.moduleLoadPatched');
if (!moduleRuntime[moduleLoadPatchedFlag]) {
    moduleRuntime[moduleLoadPatchedFlag] = true;
    moduleRuntime._load = function patchedLoad(request, parent, isMain) {
        if (request === 'openai') {
            return originalModuleLoad.call(moduleRuntime, (0, path_1.resolve)(__dirname, '../../vendor/openai'), parent, isMain);
        }
        if (request === 'openai/core') {
            return originalModuleLoad.call(moduleRuntime, (0, path_1.resolve)(__dirname, '../../vendor/openai-core'), parent, isMain);
        }
        if (request === '@azure/msal-browser') {
            return originalModuleLoad.call(moduleRuntime, (0, path_1.resolve)(__dirname, '../../vendor/msal-browser'), parent, isMain);
        }
        return originalModuleLoad.call(moduleRuntime, request, parent, isMain);
    };
}
describe('CustomAI TLS diagnostics', () => {
    let CustomAIModule;
    before(() => {
        ensureEnv('CUSTOMAI_DEFAULT_SCOPE', 'api://test/.default');
        ensureEnv('CUSTOMAI_API_KEY', 'test-api-key');
        delete require.cache[require.resolve('../../ai/CustomAI')];
        CustomAIModule = require('../../ai/CustomAI');
    });
    it('loads certificates from EGADCerts directories', () => {
        const projectRoot = (0, path_1.resolve)(__dirname, '../../..');
        const egadRoot = (0, path_1.join)(projectRoot, 'EGADCerts');
        const certsDir = (0, path_1.join)(egadRoot, 'certs');
        (0, fs_1.mkdirSync)(certsDir, { recursive: true });
        const certPath = (0, path_1.join)(certsDir, 'test-cert.pem');
        (0, fs_1.writeFileSync)(certPath, '-----BEGIN CERTIFICATE-----\nTEST\n-----END CERTIFICATE-----');
        let result;
        try {
            result = CustomAIModule.__customAITestHooks.loadCertificatesFromEnvForTest();
        }
        finally {
            (0, fs_1.rmSync)(egadRoot, { recursive: true, force: true });
        }
        if (!result) {
            assert.fail('expected certificate load result');
            return;
        }
        const normalizedDirectories = result.defaultDirectoriesApplied.map((dir) => dir.replace(/\\+/g, '/'));
        assert.ok(result.certificates && result.certificates.length > 0, 'expected certificates');
        assert.ok(normalizedDirectories.some((dir) => dir.endsWith('EGADCerts/certs')), 'expected EGADCerts directory to be applied');
        assert.ok(result.directoryCertificateCount >= 1, 'expected certificate count from directory');
    });
    it('emits diagnostic logs when fetch rejects with TLS errors', async () => {
        const logs = [];
        const dispose = (0, customAiDebug_1.registerCustomAILogSink)((level, message, extra) => {
            logs.push({ level, message, extra });
        });
        const tlsError = new Error('TLS handshake failed');
        tlsError.code = 'SELF_SIGNED_CERT_IN_CHAIN';
        const wrappedFetch = CustomAIModule.__customAITestHooks.createDiagnosticFetchForTest(async () => {
            throw tlsError;
        });
        assert.ok(wrappedFetch, 'expected diagnostic fetch wrapper');
        try {
            await assert.rejects(() => wrappedFetch('https://example.test/resource', { method: 'POST' }));
        }
        finally {
            dispose();
        }
        const failureLog = logs.find((entry) => entry.message === 'CustomAI fetch failed');
        assert.ok(failureLog, 'expected failure log entry');
        assert.strictEqual(failureLog?.level, 'warn');
        assert.strictEqual(failureLog?.extra?.errorCode, 'SELF_SIGNED_CERT_IN_CHAIN');
        assert.strictEqual(failureLog?.extra?.method, 'POST');
        assert.ok(typeof failureLog?.extra?.url === 'string' &&
            failureLog.extra.url.includes('https://example.test/resource'), 'expected URL to be logged');
    });
});
describe('CustomAIBrowser wrappers', () => {
    let CustomAIBrowser;
    before(() => {
        ensureEnv('CUSTOMAI_DEFAULT_SCOPE', 'api://test/.default');
        ensureEnv('CUSTOMAI_API_KEY', 'test-api-key');
        ensureEnv('CUSTOM_CLIENT_ID', 'client-id');
        ensureEnv('CUSTOM_TENANT_ID', 'tenant-id');
        delete require.cache[require.resolve('../../ai/index.browser')];
        CustomAIBrowser = require('../../ai/index.browser').CustomAIBrowser;
    });
    it('performs popup authentication and updates legacy aliases', async () => {
        const client = new CustomAIBrowser();
        assert.strictEqual(client.customaiIsAuthenticated(), false);
        await client.customaiAuthenticateInBrowser();
        assert.strictEqual(client.customaiIsAuthenticated(), true);
        assert.strictEqual(client.ericaiIsAuthenticated(), true);
        const username = client.customaiAuthenticatedUser();
        assert.ok(typeof username === 'string' && username.length > 0);
        assert.strictEqual(username, client.ericaiAuthenticatedUser());
    });
    it('supports logout through legacy EricAI helpers', async () => {
        const client = new CustomAIBrowser();
        await client.ericaiAuthenticateInBrowser([CustomAIBrowser.defaultScope]);
        assert.strictEqual(client.ericaiIsAuthenticated(), true);
        await client.ericaiLogout();
        assert.strictEqual(client.customaiIsAuthenticated(), false);
    });
});
//# sourceMappingURL=customai.test.js.map