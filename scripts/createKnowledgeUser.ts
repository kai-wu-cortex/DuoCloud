import { randomBytes } from 'node:crypto';
import type { Document } from 'mongodb';
import 'dotenv/config';
import { getMongoCollection } from '../src/lib/mongodb';
import { hashPassword, normalizeUsername } from '../src/server/loginApi';
import type { UserRole } from '../src/server/sessionAuth';

interface SystemUserSetupDoc extends Document {
  _id: string;
  username: string;
  role: UserRole;
  salt: string;
  passwordHash: string;
  createdAt?: Date;
  updatedAt: Date;
}

function getArg(name: string): string {
  const index = process.argv.indexOf(`--${name}`);
  const value = index >= 0 ? process.argv[index + 1] : '';
  if (!value) throw new Error(`Missing --${name}`);
  return value;
}

function getRole(value: string): UserRole {
  if (value === 'viewer' || value === 'editor' || value === 'admin') return value;
  throw new Error('role must be viewer, editor, or admin');
}

const username = normalizeUsername(getArg('username'));
const password = getArg('password');
const role = getRole(getArg('role'));

if (!username) {
  throw new Error('username cannot be empty');
}

const salt = randomBytes(16).toString('hex');
const passwordHash = hashPassword(password, salt);
const now = new Date();
const collection = await getMongoCollection<SystemUserSetupDoc>('system_users');

await collection.updateOne(
  { _id: username },
  {
    $set: {
      _id: username,
      username,
      role,
      salt,
      passwordHash,
      updatedAt: now,
    },
    $setOnInsert: { createdAt: now },
  },
  { upsert: true },
);

console.log(`User ${username} saved with role ${role}`);
