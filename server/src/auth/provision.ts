import { readFileSync } from 'node:fs';
import { loadConfig } from '../config.js';
import { openDatabase } from '../db/database.js';
import { AuthService } from './service.js';

// Intended for local administrator's terminal only: printf '%s' "$SECRET" | npm --prefix server run auth:provision -- username
const username=process.argv[2];
if(!username || process.stdin.isTTY) {
  console.error('Usage: pipe a password on stdin and supply one username argument');
  process.exitCode=1;
} else {
  const config=loadConfig();
  const password=readFileSync(0,'utf8').replace(/\r?\n$/,'');
  const db=openDatabase(config.databasePath);
  try {
    const shared=username.toLowerCase()==='metrobus';
    const id=await new AuthService(db).createUser(username,password,shared);
    console.log(`Created local account id ${id}`);
  } finally {
    db.close();
  }
}
