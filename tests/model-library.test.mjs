import test from 'node:test';
import assert from 'node:assert/strict';
import { ModelLibrary } from '../model-library.js';

function deferred() {
  let resolve, reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

function harness() {
  const requests = new Map();
  const loaded = [], prepared = [], activated = [], pending = [], failures = [];
  const library = new ModelLibrary({
    loadModel(id) {
      loaded.push(id);
      const request = deferred();
      if (!requests.has(id)) requests.set(id, []);
      requests.get(id).push(request);
      return request.promise;
    },
    prepareModel(model, id) {
      const result = { ...model, preparedFor: id };
      prepared.push({ id, result });
      return result;
    },
    activateModel(id, model) { activated.push({ id, model }); },
    pending(id) { pending.push(id); },
    failure(id, error) { failures.push({ id, error }); },
  });
  return { library, requests, loaded, prepared, activated, pending, failures };
}

// Give implementations that start loads in a Promise continuation time to enqueue them.
async function requestsStarted() { await Promise.resolve(); }

test('a late first load cannot replace the latest selected passport', async () => {
  const h = harness();
  const us = h.library.select('us');
  const taiwan = h.library.select('taiwan');
  await requestsStarted();
  h.requests.get('taiwan')[0].resolve({ name: 'Taiwan' });
  assert.equal(await taiwan, true);
  h.requests.get('us')[0].resolve({ name: 'US' });
  assert.equal(await us, false);
  assert.deepEqual(h.activated.map(value => value.id), ['taiwan']);
  assert.equal(h.activated[0].model.name, 'Taiwan');
  assert.equal(h.activated[0].model.preparedFor, 'taiwan');
  assert.deepEqual(h.pending, ['us', 'taiwan']);
});

test('rapid US → Taiwan → US shares the US request and activates only the final selection', async () => {
  const h = harness();
  const firstUS = h.library.select('us');
  const taiwan = h.library.select('taiwan');
  const lastUS = h.library.select('us');
  await requestsStarted();
  assert.deepEqual(h.loaded, ['us', 'taiwan']);
  h.requests.get('us')[0].resolve({ name: 'US' });
  assert.equal(await firstUS, false);
  assert.equal(await lastUS, true);
  h.requests.get('taiwan')[0].resolve({ name: 'Taiwan' });
  assert.equal(await taiwan, false);
  assert.deepEqual(h.activated.map(value => value.id), ['us']);
  assert.equal(h.prepared.filter(value => value.id === 'us').length, 1);
});

test('cached models are reused without loading or preparing again', async () => {
  const h = harness();
  const first = h.library.select('us');
  await requestsStarted();
  h.requests.get('us')[0].resolve({ name: 'US' });
  assert.equal(await first, true);
  const cachedModel = h.activated[0].model;
  assert.equal(await h.library.select('us'), true);
  assert.deepEqual(h.loaded, ['us']);
  assert.equal(h.prepared.length, 1);
  assert.equal(h.activated[1].model, cachedModel);
  assert.deepEqual(h.pending, ['us', 'us']);
});

test('repeated selection during loading makes one request and one activation', async () => {
  const h = harness();
  const first = h.library.select('taiwan');
  const second = h.library.select('taiwan');
  await requestsStarted();
  assert.deepEqual(h.loaded, ['taiwan']);
  h.requests.get('taiwan')[0].resolve({ name: 'Taiwan' });
  assert.deepEqual(await Promise.all([first, second]), [false, true]);
  assert.equal(h.prepared.length, 1);
  assert.equal(h.activated.length, 1);
});

test('a failed current load reports failure and is retried on the next selection', async () => {
  const h = harness();
  const first = h.library.select('taiwan');
  await requestsStarted();
  const networkError = new Error('network unavailable');
  h.requests.get('taiwan')[0].reject(networkError);
  assert.equal(await first, false);
  assert.deepEqual(h.failures, [{ id: 'taiwan', error: networkError }]);
  assert.equal(h.activated.length, 0);
  const retry = h.library.select('taiwan');
  await requestsStarted();
  assert.deepEqual(h.loaded, ['taiwan', 'taiwan']);
  h.requests.get('taiwan')[1].resolve({ name: 'Taiwan retry' });
  assert.equal(await retry, true);
  assert.equal(h.activated[0].model.name, 'Taiwan retry');
  assert.equal(h.failures.length, 1);
});

test('a stale load error cannot overwrite the current model status', async () => {
  const h = harness();
  const oldUS = h.library.select('us');
  const currentTaiwan = h.library.select('taiwan');
  await requestsStarted();
  h.requests.get('taiwan')[0].resolve({ name: 'Taiwan' });
  assert.equal(await currentTaiwan, true);
  h.requests.get('us')[0].reject(new Error('old request failed'));
  assert.equal(await oldUS, false);
  assert.deepEqual(h.failures, []);
  assert.deepEqual(h.activated.map(value => value.id), ['taiwan']);
});
