// Passwort für den Bearbeiten-Modus festlegen: `npm run edit-password`
// Fragt das Passwort verdeckt ab, bildet einen PBKDF2-Hash (Einweg – lässt sich nicht zurückrechnen) und
// speichert ihn als Worker-Secret EDIT_PASSWORD_HASH. Das Passwort selbst wird nirgends gespeichert.
// Ein neues Passwort meldet alle bestehenden Sitzungen ab. Prüfung: worker/edit.ts → checkPassword().
import { execSync } from 'node:child_process';
import { pbkdf2Sync, randomBytes } from 'node:crypto';
import { stdin, stdout } from 'node:process';

// Muss zum Worker passen; mehr Runden kosten dort CPU-Zeit (kostenloser Tarif: 10 ms je Anfrage)
const ROUNDS = 10_000;

function ask(question) {
  return new Promise((resolve) => {
    stdout.write(question);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');
    let value = '';
    const onData = (char) => {
      if (char === '\r' || char === '\n') {
        stdin.setRawMode(false);
        stdin.pause();
        stdin.off('data', onData);
        stdout.write('\n');
        resolve(value);
      } else if (char === '\u0003') {
        process.exit(1);
      } else if (char === '\u007f' || char === '\b') {
        value = value.slice(0, -1);
      } else {
        value += char;
      }
    };
    stdin.on('data', onData);
  });
}

const password = await ask('Neues Passwort: ');
if (password.length < 10) {
  console.error('Bitte mindestens 10 Zeichen verwenden.');
  process.exit(1);
}
if ((await ask('Passwort wiederholen: ')) !== password) {
  console.error('Die Passwörter stimmen nicht überein.');
  process.exit(1);
}

const salt = randomBytes(16);
const hash = pbkdf2Sync(password, salt, ROUNDS, 32, 'sha256');
const value = `pbkdf2$${ROUNDS}$${salt.toString('base64')}$${hash.toString('base64')}`;

execSync('npx wrangler secret put EDIT_PASSWORD_HASH', { input: value, stdio: ['pipe', 'inherit', 'inherit'] });
console.log('Fertig – das Passwort gilt sofort.');
