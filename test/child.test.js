import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { readInChild } from '../child.js';

// Stands in for Electron's utilityProcess: answer(path) decides what it does with the path it's sent.
function fakeFork(answer) {
  const reader = new EventEmitter();
  reader.killed = 0;
  reader.kill = () => { reader.killed++; setImmediate(() => reader.emit('exit', 0)); };
  reader.postMessage = (path) => setImmediate(() => answer(reader, path));
  return { fork: () => reader, reader };
}

test('the answer comes back and the process is killed', async () => {
  const { fork, reader } = fakeFork((r, path) => r.emit('message', { invoices: [path], vats: [] }));
  assert.deepEqual(await readInChild(fork, 'a.mdb'), { invoices: ['a.mdb'], vats: [] });
  assert.equal(reader.killed, 1);
});

test('an error from the reader rejects with its message', async () => {
  const { fork } = fakeFork((r) => r.emit('message', { error: 'file rotto' }));
  await assert.rejects(readInChild(fork, 'a.mdb'), /file rotto/);
});

test('a reader that ends before answering rejects', async () => {
  const { fork } = fakeFork((r) => r.emit('exit', 1));
  await assert.rejects(readInChild(fork, 'a.mdb'), /interrotta \(codice 1\)/);
});

test('a reader that never answers is killed when the time runs out', async () => {
  const { fork, reader } = fakeFork(() => {});
  await assert.rejects(readInChild(fork, 'a.mdb', 10), /troppo lunga/);
  assert.equal(reader.killed, 1);
});
