import 'dotenv/config';
import mongoose from 'mongoose';
import { seedDatabase } from './seed.js';

const uri = process.env.MONGODB_URI;
if (!uri || /YOUR_USERNAME|YOUR_PASSWORD|YOUR_CLUSTER/.test(uri)) {
  console.error('MongoDB setup check failed: MONGODB_URI is not configured. Copy .env.example to .env and paste your MongoDB Atlas URI.');
  process.exit(1);
}
try {
  console.log('[db:check] Connecting to MongoDB Atlas...');
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000, family: 4 });
  await mongoose.connection.db.admin().command({ ping: 1 });
  console.log(`[db:check] Connected to ${mongoose.connection.name}.`);
  await seedDatabase();
  console.log('[db:check] Database and starter content are ready.');
  await mongoose.disconnect();
} catch (error) {
  console.error('\nMongoDB setup check failed:');
  console.error(error.message);
  if (error.message.includes('IP')) console.error('Check Atlas Network Access and allow your current public IP address.');
  if (error.message.includes('Authentication')) console.error('Check the database username/password in MONGODB_URI. URL-encode reserved password characters.');
  if (error.message.includes('querySrv')) console.error('The Atlas SRV lookup failed. Check DNS/network access or copy the standard connection string from Atlas.');
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
}
