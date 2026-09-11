import { Worker } from 'node:worker_threads';
import { resolve } from 'node:path';
export function runImport(buffer, settings) {
  return new Promise((resolve, reject) => {
    const workerPath =
      process.env.COMPARADOR_STORAGE === 'netlify'
        ? resolve('backend/src/services/excelWorker.js')
        : new URL('./excelWorker.js', import.meta.url);
    const worker = new Worker(workerPath, {
      workerData: { buffer, settings },
      resourceLimits: { maxOldGenerationSizeMb: 256 },
    });
    const timer = setTimeout(() => {
      worker.terminate();
      reject(Error('El archivo tardó demasiado en procesarse. Dividilo en hojas más pequeñas.'));
    }, 20000);
    worker.once('message', (message) => {
      clearTimeout(timer);
      worker.terminate();
      message.error ? reject(Error(message.error)) : resolve(message.result);
    });
    worker.once('error', () => {
      clearTimeout(timer);
      reject(Error('No se pudo procesar el archivo dentro del límite de memoria.'));
    });
    worker.once('exit', (code) => {
      clearTimeout(timer);
      if (code !== 0) reject(Error('Se interrumpió la lectura del Excel.'));
    });
  });
}
