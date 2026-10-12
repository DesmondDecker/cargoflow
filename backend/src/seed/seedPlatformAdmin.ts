import { connectDb } from '../config/db';
import { env } from '../config/env';
import { PlatformAdminModel } from '../models/PlatformAdmin';
import { hashPassword } from '../utils/password';
import mongoose from 'mongoose';

// There is deliberately no public "register platform admin" route — the
// only way the first one gets created is this script, run once against the
// target database. Run again later (with different env vars) to create
// additional admins if you don't want to use the in-app "create admin" screen.
async function run() {
  if (!env.seedAdmin.password) {
    console.error('Set SEED_ADMIN_PASSWORD before running this script.');
    process.exit(1);
  }

  await connectDb();

  const existing = await PlatformAdminModel.findOne({ email: env.seedAdmin.email.toLowerCase() });
  if (existing) {
    console.log(`Platform admin ${env.seedAdmin.email} already exists — nothing to do.`);
  } else {
    const passwordHash = await hashPassword(env.seedAdmin.password);
    await PlatformAdminModel.create({ name: env.seedAdmin.name, email: env.seedAdmin.email.toLowerCase(), passwordHash });
    console.log(`Created platform admin: ${env.seedAdmin.email}`);
  }

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
