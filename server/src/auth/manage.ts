import { readFileSync } from 'node:fs';
import { loadConfig } from '../config.js';
import { openDatabase } from '../db/database.js';
import { AuthService } from './service.js';

// Sensitive account management requires local server access, not directing privileges.
// No passwords in argv or shell history. Expects new password via stdin for create/reset.
const [action, identifier] = process.argv.slice(2);
const requiresPassword = action === 'create' || action === 'reset-password';
const validId = identifier && /^[1-9][0-9]*$/.test(identifier) ? Number(identifier) : NaN;

if (!['list', 'create', 'reset-password', 'activate', 'deactivate'].includes(action ?? '') ||
    (action !== 'list' && !identifier) ||
    (requiresPassword && process.stdin.isTTY) ||
    ((action === 'reset-password' || action === 'activate' || action === 'deactivate') &&
      !Number.isSafeInteger(validId))) {
  console.error('Usage: auth:manage -- list | create USERNAME | reset-password USER_ID | activate USER_ID | deactivate USER_ID');
  console.error('For create/reset-password, pipe a password via stdin; never pass it as an argument.');
  process.exitCode=1;
} else {
  const db=openDatabase(loadConfig().databasePath);
  try {
    const auth=new AuthService(db);
    if (action==='list') {
      for(const user of auth.listUsers()) console.log(JSON.stringify(user));
    } else if (action==='create') {
      const password=readFileSync(0,'utf8').replace(/\r?\n$/,'');
      const id=await auth.createUser(identifier,password,identifier.toLowerCase()==='metrobus');
      console.log('Created user ID:',id);
    } else if (action==='reset-password') {
      const password=readFileSync(0,'utf8').replace(/\r?\n$/,'');
      if (!await auth.resetPassword(validId,password)) throw new Error('Account not found');
      console.log('Password reset and all sessions revoked for user ID:',validId);
    } else {
      if (!auth.setActive(validId,action==='activate')) throw new Error('Account not found');
      console.log('Updated account ID:',validId);
    }
  } finally { db.close(); }
}
