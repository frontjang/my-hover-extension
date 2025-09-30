"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const path = require("path");
const test_electron_1 = require("@vscode/test-electron");
async function main() {
    const extensionDevelopmentPath = path.resolve(__dirname, '../../');
    const extensionTestsPath = path.resolve(__dirname, './suite/index');
    await (0, test_electron_1.runTests)({ extensionDevelopmentPath, extensionTestsPath });
}
main().catch((err) => {
    console.error('Failed to run tests');
    if (err) {
        console.error(err);
    }
    process.exit(1);
});
//# sourceMappingURL=runTest.js.map