import { parentPort, workerData } from 'node:worker_threads';
import { inspectWorkbook } from './excelImport.js';
try {
  parentPort.postMessage({
    result: inspectWorkbook(Buffer.from(workerData.buffer), workerData.settings),
  });
} catch (e) {
  parentPort.postMessage({ error: e.message });
}
