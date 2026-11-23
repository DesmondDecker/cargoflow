import mongoose from 'mongoose';
import { connectDb } from '../config/db';
import { AgencyModel } from '../models/Agency';
import { UserModel } from '../models/User';
import { hashPassword } from '../utils/password';
import { checkPinStrength } from '../services/pinRules';
import { revokeAllForSubject } from '../services/tokenService';

// Sets a PIN for one agency user. Use it once for the owner of an agency that
// existed before PINs were introduced (nobody can sign in to such an account
// until it has a PIN), or if every owner has forgotten theirs.
//   npm run reset:pin -- <AGENCY_CODE> "<user name or phone>" <6-digit PIN>
async function run() {
  const [agencyCode, identifier, pin] = process.argv.slice(2);
  if (!agencyCode || !identifier || !pin) {
    console.error('Usage: npm run reset:pin -- <AGENCY_CODE> "<user name or phone>" <6-digit PIN>');
    process.exit(1);
  }
  const weak = checkPinStrength(pin);
  if (weak) {
    console.error(weak);
    process.exit(1);
  }

  await connectDb();
  const agency = await AgencyModel.findOne({ agencyCode: agencyCode.trim().toUpperCase() });
  if (!agency) {
    console.error('No agency with that code.');
    process.exit(1);
  }
  const user = await UserModel.findOne({ agencyId: agency._id, $or: [{ name: identifier }, { phone: identifier }] }).collation({ locale: 'en', strength: 2 });
  if (!user) {
    console.error('No user with that name or phone in this agency.');
    process.exit(1);
  }
  user.pinHash = await hashPassword(pin);
  user.pinFailedAttempts = 0;
  user.pinLockedUntil = undefined;
  await user.save();
  await revokeAllForSubject(user._id, 'agency-app');
  console.log(`PIN set for ${user.name} (${user.role}) in ${agency.name}.`);
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
