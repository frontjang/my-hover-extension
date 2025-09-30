const path = require('path');
const Mocha = require('mocha');

async function run() {
  const mocha = new Mocha({
    ui: 'tdd',
    color: true,
    timeout: 10_000
  });

  const testsRoot = path.resolve(__dirname, '.');
  mocha.addFile(path.join(testsRoot, 'sanity.test.js'));
  mocha.addFile(path.join(testsRoot, 'prompts.test.js'));

  await new Promise((resolve, reject) => {
    try {
      mocha.run((failures) => {
        if (failures) {
          reject(new Error(`${failures} tests failed.`));
        } else {
          resolve();
        }
      });
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = { run };
