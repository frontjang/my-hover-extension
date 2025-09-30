import * as path from 'path';
import * as Mocha from 'mocha';

export async function run(): Promise<void> {
  const mocha = new Mocha({
    ui: 'tdd',
    color: true,
    timeout: 10_000,
  });

  const testsRoot = path.resolve(__dirname, '.');
  mocha.addFile(path.join(testsRoot, 'sanity.test.js'));
  mocha.addFile(path.join(testsRoot, 'prompts.test.js'));

  await new Promise<void>((resolve, reject) => {
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
