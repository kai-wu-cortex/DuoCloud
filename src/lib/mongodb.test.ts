import test from 'node:test';
import assert from 'node:assert/strict';

const ORIGINAL_ENV = { ...process.env };

test.afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

test('getMongoDbName defaults to duocloudDB', async () => {
  const { getMongoDbName } = await import('./mongodb');
  delete process.env.KNOWLEDGE_DB_NAME;
  assert.equal(getMongoDbName(), 'duocloudDB');
});

test('getPrimaryMongoUri requires a configured uri', async () => {
  const { getPrimaryMongoUri } = await import('./mongodb');
  delete process.env.MONGODB_URI;
  delete process.env.MONGODB_DIRECT_URI;
  assert.throws(() => getPrimaryMongoUri(), /缺少 MONGODB_URI/);
});

test('getPrimaryMongoUri prefers MONGODB_URI over direct uri', async () => {
  const { getPrimaryMongoUri } = await import('./mongodb');
  process.env.MONGODB_URI = 'mongodb+srv://primary';
  process.env.MONGODB_DIRECT_URI = 'mongodb://direct';
  assert.equal(getPrimaryMongoUri(), 'mongodb+srv://primary');
});
