import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { Admin } from './models.js';
const uri = process.env.MONGODB_URI;
const email = (process.env.ADMIN_EMAIL || 'admin@rdental.demo').toLowerCase().trim();
const password = process.env.ADMIN_PASSWORD || 'ChangeMe123!';
if (!uri || /YOUR_USERNAME|YOUR_PASSWORD|YOUR_CLUSTER/.test(uri)) { console.error('Missing MONGODB_URI. Configure .env first.'); process.exit(1); }
if (password.length < 12) { console.error('Set ADMIN_PASSWORD to at least 12 characters before resetting.'); process.exit(1); }
try {
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 12000, family: 4 });
  const passwordHash = await bcrypt.hash(password, 12);
  await Admin.updateOne({ email }, { $set: { passwordHash, active: true, role: 'admin' }, $setOnInsert: { email } }, { upsert: true });
  console.log(`Admin credentials reset for ${email}.`);
  await mongoose.disconnect();
} catch (error) { console.error(`Admin reset failed: ${error.message}`); await mongoose.disconnect().catch(() => {}); process.exit(1); }
