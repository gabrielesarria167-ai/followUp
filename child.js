// One archive read in its own short-lived process (reader.js; main.js passes the fork). Settles once, on the
// answer, the process ending first, or the time running out; the process is killed in every case, so a hung
// read can't hold up the reads queued behind it (session.js).
export const READ_TIMEOUT_MS = 2 * 60 * 1000;

export function readInChild(fork, path, timeoutMs = READ_TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    const reader = fork();
    let done = false;
    const settle = (err, result) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      reader.kill();
      if (err) reject(err);
      else resolve(result);
    };
    const timer = setTimeout(() => settle(new Error('lettura troppo lunga, interrotta')), timeoutMs);
    reader.once('message', (result) => settle(result.error && new Error(result.error), result));
    reader.once('exit', (code) => settle(new Error(`lettura interrotta (codice ${code})`)));
    reader.postMessage(path);
  });
}
