import { readArchive } from './db.js';

// A short-lived process per read (main.js): the raw files, ~370 MB, are freed with it and only the invoices,
// ~20 MB, come back. It keeps listening, so it ends when main.js kills it, never before its answer arrives.
process.parentPort.on('message', ({ data: path }) => {
  try {
    process.parentPort.postMessage(readArchive(path));
  } catch (err) {
    process.parentPort.postMessage({ error: err.message });
  }
});
