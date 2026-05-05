const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongoServer;

console.log('Jest setup loaded ✅');

// ── Start in-memory MongoDB before all tests ──
beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri   = mongoServer.getUri();
  await mongoose.connect(uri);
});

// ── Clean all collections between each test ───
afterEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
});

// ── Stop server after all tests ───────────────
afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});