import bcrypt from 'bcryptjs';
import { stdin, stdout } from 'node:process';
import { Writable } from 'node:stream';
import { createInterface } from 'node:readline/promises';
import { db } from './db.js';

async function main() {
  if (!stdin.isTTY || !stdout.isTTY) throw new Error('Run this command in an interactive terminal so the password can be entered privately.');
  const prompt = createInterface({ input: stdin, output: stdout });
  const email = (await prompt.question('Administrator email: ')).trim().toLowerCase();
  const name = (await prompt.question('Administrator name: ')).trim();
  prompt.close();

  const hiddenOutput = new Writable({ write(_chunk, _encoding, callback) { callback(); } });
  const hiddenPrompt = createInterface({ input: stdin, output: hiddenOutput, terminal: true });
  stdout.write('Password (16+ characters, hidden): ');
  const password = await hiddenPrompt.question('');
  stdout.write('\nConfirm password (hidden): ');
  const confirmation = await hiddenPrompt.question('');
  hiddenPrompt.close();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Enter a valid email address.');
  if (name.length < 2 || name.length > 100) throw new Error('Name must be between 2 and 100 characters.');
  if (password.length < 16 || password.length > 200) throw new Error('Password must be between 16 and 200 characters.');
  if (password !== confirmation) throw new Error('The passwords did not match.');
  if (db.prepare('SELECT 1 FROM users WHERE email=? COLLATE NOCASE').get(email)) throw new Error('An account with that email already exists.');

  const hash = await bcrypt.hash(password, 12);
  db.prepare("INSERT INTO users(email,password_hash,role,name) VALUES(?,?,'admin',?)").run(email, hash, name);
  console.log(`Administrator account created for ${email}.`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Could not create administrator.');
  process.exitCode = 1;
}).finally(() => db.close());
