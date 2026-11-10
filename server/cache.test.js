// Tests for server/cache.js. Run with: npm test
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { createCache } from './cache.js';

const MIN = 60 * 1000;
const TTL = 5 * MIN;
const MAX_STALE = 30 * MIN;

/** A cache with a clock the test moves by hand, and a record of background errors. */
function setup() {
  const clock = { now: 1_000_000 };
  const backgroundErrors = [];
  const cache = createCache({
    ttl: TTL,
    maxStale: MAX_STALE,
    now: () => clock.now,
    onBackgroundError: (key, error) => backgroundErrors.push([key, error.message]),
  });
  return { cache, clock, backgroundErrors };
}

/** A load function whose fetches the test resolves or rejects by hand: calls[i].resolve(value). */
function controlledLoad() {
  const calls = [];
  const load = () =>
    new Promise((resolve, reject) => {
      calls.push({ resolve, reject });
    });
  return { load, calls };
}

/** Lets pending promise callbacks run. */
const flush = () => new Promise((resolve) => setImmediate(resolve));

/** True when the promise has settled by the next flush (i.e. the caller did not have to wait). */
async function isSettled(promise) {
  let settled = false;
  promise.then(
    () => (settled = true),
    () => (settled = true),
  );
  await flush();
  return settled;
}

/** Fills the cache for `key` with `value` (as a finished first load) and returns the load mock. */
async function primed(cache, key, value) {
  const fetches = controlledLoad();
  const first = cache.cached(key, fetches.load);
  fetches.calls[0].resolve(value);
  await first;
  return fetches;
}

describe('first load and fresh cache (unchanged behaviour)', () => {
  test('the first request waits for the fetch; parallel requests share it', async () => {
    const { cache } = setup();
    const fetches = controlledLoad();
    const a = cache.cached('deals', fetches.load);
    const b = cache.cached('deals', fetches.load);
    assert.equal(fetches.calls.length, 1);
    assert.equal(await isSettled(a), false);
    fetches.calls[0].resolve('v1');
    assert.equal(await a, 'v1');
    assert.equal(await b, 'v1');
  });

  test('younger than 5 min: answered from the cache, no fetch, header = time left', async () => {
    const { cache, clock } = setup();
    const fetches = await primed(cache, 'deals', 'v1');
    clock.now += 4 * MIN;
    assert.equal(await cache.cached('deals', fetches.load), 'v1');
    assert.equal(fetches.calls.length, 1);
    assert.equal(cache.expiresIn(), 1 * MIN);
  });

  test('a failed first load is not cached; the next request tries again', async () => {
    const { cache } = setup();
    const fetches = controlledLoad();
    const first = cache.cached('deals', fetches.load);
    fetches.calls[0].reject(new Error('HTTP 503'));
    await assert.rejects(first, /HTTP 503/);
    const second = cache.cached('deals', fetches.load);
    assert.equal(fetches.calls.length, 2);
    fetches.calls[1].resolve('v1');
    assert.equal(await second, 'v1');
  });
});

describe('1. between 5 and 30 min old: cached data is answered immediately', () => {
  for (const [label, age] of [['5:00', 5 * MIN], ['6:00', 6 * MIN], ['29:59', 29 * MIN + 59 * 1000]]) {
    test(`${label} min old: answered at once with the cached data`, async () => {
      const { cache, clock } = setup();
      const fetches = await primed(cache, 'deals', 'old');
      clock.now += age;
      const answer = cache.cached('deals', fetches.load);
      assert.equal(await isSettled(answer), true, 'the request must not wait for Bitrix24');
      assert.equal(await answer, 'old');
    });
  }

  test('the expiry header is 0 while old data is answered, so the browser does not keep it', async () => {
    const { cache, clock } = setup();
    const fetches = await primed(cache, 'deals', 'old');
    clock.now += 6 * MIN;
    await cache.cached('deals', fetches.load);
    assert.equal(cache.expiresIn(), 0);
  });

  test('once the background fetch finishes, the next request gets the fresh data and the expiry restarts', async () => {
    const { cache, clock } = setup();
    const fetches = await primed(cache, 'deals', 'old');
    clock.now += 6 * MIN;
    await cache.cached('deals', fetches.load);
    fetches.calls[1].resolve('fresh');
    await flush();
    assert.equal(await cache.cached('deals', fetches.load), 'fresh');
    assert.equal(fetches.calls.length, 2);
    assert.equal(cache.expiresIn(), TTL);
  });
});

describe('2. only one background refresh at a time', () => {
  test('50 parallel requests between 5 and 30 min start exactly one background fetch', async () => {
    const { cache, clock } = setup();
    const fetches = await primed(cache, 'deals', 'old');
    clock.now += 6 * MIN;
    const answers = await Promise.all(Array.from({ length: 50 }, () => cache.cached('deals', fetches.load)));
    assert.ok(answers.every((value) => value === 'old'));
    assert.equal(fetches.calls.length, 2);
  });

  test('passing 30 min while the background fetch runs shares it instead of starting a second one', async () => {
    const { cache, clock } = setup();
    const fetches = await primed(cache, 'deals', 'old');
    clock.now += 20 * MIN;
    cache.cached('deals', fetches.load); // background fetch starts
    clock.now += 11 * MIN; // now 31 min old, background fetch still running
    const waiting = cache.cached('deals', fetches.load);
    assert.equal(fetches.calls.length, 2);
    fetches.calls[1].resolve('fresh');
    assert.equal(await waiting, 'fresh');
  });

  test('different keys refresh independently', async () => {
    const { cache, clock } = setup();
    const deals = await primed(cache, 'deals', 'old deals');
    const users = await primed(cache, 'users', 'old users');
    clock.now += 6 * MIN;
    await cache.cached('deals', deals.load);
    await cache.cached('users', users.load);
    assert.equal(deals.calls.length, 2);
    assert.equal(users.calls.length, 2);
  });
});

describe('3. 30 min old or older: a fresh fetch is required', () => {
  for (const [label, age] of [['30:00', 30 * MIN], ['45:00', 45 * MIN]]) {
    test(`${label} min old: the request waits and gets fresh data, never the old data`, async () => {
      const { cache, clock } = setup();
      const fetches = await primed(cache, 'deals', 'old');
      clock.now += age;
      const answer = cache.cached('deals', fetches.load);
      assert.equal(await isSettled(answer), false, 'the request must wait for fresh data');
      assert.equal(fetches.calls.length, 2);
      fetches.calls[1].resolve('fresh');
      assert.equal(await answer, 'fresh');
    });
  }

  test('requests arriving during that fetch share it', async () => {
    const { cache, clock } = setup();
    const fetches = await primed(cache, 'deals', 'old');
    clock.now += 31 * MIN;
    const answers = Array.from({ length: 20 }, () => cache.cached('deals', fetches.load));
    assert.equal(fetches.calls.length, 2);
    fetches.calls[1].resolve('fresh');
    assert.ok((await Promise.all(answers)).every((value) => value === 'fresh'));
  });

  test('if Bitrix24 is down, the request fails rather than answering data older than 30 min', async () => {
    const { cache, clock } = setup();
    const fetches = await primed(cache, 'deals', 'old');
    clock.now += 31 * MIN;
    const answer = cache.cached('deals', fetches.load);
    fetches.calls[1].reject(new Error('Bitrix24 down'));
    await assert.rejects(answer, /Bitrix24 down/);
  });

  test('if a shared background fetch fails after 30 min, the request fails and the next one fetches again', async () => {
    const { cache, clock } = setup();
    const fetches = await primed(cache, 'deals', 'old');
    clock.now += 20 * MIN;
    cache.cached('deals', fetches.load);
    clock.now += 11 * MIN;
    const answer = cache.cached('deals', fetches.load);
    fetches.calls[1].reject(new Error('Bitrix24 down'));
    await assert.rejects(answer, /Bitrix24 down/);
    await flush();
    const retry = cache.cached('deals', fetches.load);
    assert.equal(fetches.calls.length, 3);
    fetches.calls[2].resolve('fresh');
    assert.equal(await retry, 'fresh');
  });
});

describe('4. Refresh data (clear) forces a fresh fetch', () => {
  test('after clear, the next request waits for a fresh fetch even if the data was under 5 min old', async () => {
    const { cache, clock } = setup();
    const fetches = await primed(cache, 'deals', 'old');
    clock.now += 1 * MIN;
    cache.clear();
    const answer = cache.cached('deals', fetches.load);
    assert.equal(await isSettled(answer), false);
    assert.equal(fetches.calls.length, 2);
    fetches.calls[1].resolve('refreshed');
    assert.equal(await answer, 'refreshed');
    assert.equal(cache.expiresIn(), TTL);
  });

  test('a background fetch that finishes after the refresh never overwrites the refreshed data', async () => {
    const { cache, clock } = setup();
    const fetches = await primed(cache, 'deals', 'old');
    clock.now += 6 * MIN;
    await cache.cached('deals', fetches.load); // background fetch = calls[1]
    cache.clear();
    const refreshed = cache.cached('deals', fetches.load); // refresh fetch = calls[2]
    fetches.calls[2].resolve('refreshed');
    await refreshed;
    fetches.calls[1].resolve('late background');
    await flush();
    assert.equal(await cache.cached('deals', fetches.load), 'refreshed');
  });

  test('a first load that finishes after the refresh never overwrites the refreshed data', async () => {
    const { cache } = setup();
    const fetches = controlledLoad();
    cache.cached('deals', fetches.load); // calls[0], still running
    cache.clear();
    const refreshed = cache.cached('deals', fetches.load); // calls[1]
    fetches.calls[1].resolve('refreshed');
    await refreshed;
    fetches.calls[0].resolve('late first load');
    await flush();
    assert.equal(await cache.cached('deals', fetches.load), 'refreshed');
  });
});

describe('5. a failed background refresh keeps the cached data', () => {
  test('the failure is reported and the cached data is still answered', async () => {
    const { cache, clock, backgroundErrors } = setup();
    const fetches = await primed(cache, 'deals', 'old');
    clock.now += 6 * MIN;
    await cache.cached('deals', fetches.load);
    fetches.calls[1].reject(new Error('QUERY_LIMIT_EXCEEDED'));
    await flush();
    assert.deepEqual(backgroundErrors, [['deals', 'QUERY_LIMIT_EXCEEDED']]);
    assert.equal(await cache.cached('deals', fetches.load), 'old');
  });

  test('the next request retries in the background, and a successful retry stores fresh data', async () => {
    const { cache, clock } = setup();
    const fetches = await primed(cache, 'deals', 'old');
    clock.now += 6 * MIN;
    await cache.cached('deals', fetches.load);
    fetches.calls[1].reject(new Error('HTTP 503'));
    await flush();
    assert.equal(await cache.cached('deals', fetches.load), 'old');
    assert.equal(fetches.calls.length, 3, 'one new background fetch');
    fetches.calls[2].resolve('fresh');
    await flush();
    assert.equal(await cache.cached('deals', fetches.load), 'fresh');
  });

  test('repeated failures keep the data until it is 30 min old, one attempt at a time', async () => {
    const { cache, clock, backgroundErrors } = setup();
    const fetches = await primed(cache, 'deals', 'old');
    for (const minutesOld of [6, 10, 20, 29]) {
      clock.now = 1_000_000 + minutesOld * MIN;
      const before = fetches.calls.length;
      assert.equal(await cache.cached('deals', fetches.load), 'old');
      assert.equal(await cache.cached('deals', fetches.load), 'old');
      assert.equal(fetches.calls.length, before + 1, 'one background fetch per attempt');
      fetches.calls.at(-1).reject(new Error('down'));
      await flush();
    }
    assert.equal(backgroundErrors.length, 4);
  });
});
