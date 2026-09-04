// Har system email ka matter dekh kar batata hai ki uske {{variable}} sach me
// bhare ja rahe hain ya khali reh jate hain.
//
// Yeh jaanch isliye zaroori hai: template me `{{set_password_url}}` likha ho
// aur code `invite_url` bheje, to email me button ka link KHALI chala jata
// hai — aur kisi ko pata bhi nahi chalta jab tak koi shikayat na kare.
import fs from 'node:fs';
import path from 'node:path';

const { systemEmailTemplates } = await import('./src/data/systemEmails.js');

// Server ke code me kaun se variable bheje jate hain, wo dhoondte hain.
const SERVER_DIR = 'server/src';

function allFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? allFiles(full) : full.endsWith('.js') ? [full] : [];
  });
}

const serverCode = allFiles(SERVER_DIR)
  .map((f) => fs.readFileSync(f, 'utf8'))
  .join('\n');

/** systemMail.js har email me ye variable khud bhar deta hai. */
const ALWAYS = ['app_name', 'company', 'support_email', 'website', 'address', 'name'];

let problems = 0;

for (const template of systemEmailTemplates) {
  // Template me jo {{...}} likhe hain
  const inTemplate = [
    ...new Set(
      [...`${template.subject}${template.html}`.matchAll(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g)].map((m) => m[1])
    ),
  ];

  // sendSystemEmail('<key>', ...) ke aas-paas ka code nikalte hain
  const call = serverCode.match(
    new RegExp(`sendSystemEmail\\(\\s*'${template.key.replace('.', '\\.')}'[\\s\\S]{0,700}?\\n\\s*\\);`)
  );

  if (!call) {
    console.log(`SKIP   ${template.key.padEnd(24)} kahin se bheji hi nahi jati`);
    continue;
  }

  const sent = [...new Set([...call[0].matchAll(/(\w+):/g)].map((m) => m[1]))];
  const missing = inTemplate.filter((v) => !ALWAYS.includes(v) && !sent.includes(v));

  if (missing.length) {
    problems += 1;
    console.log(`GALAT  ${template.key.padEnd(24)} khali reh jayenge: ${missing.join(', ')}`);
  } else {
    console.log(`ok     ${template.key.padEnd(24)}`);
  }
}

console.log(problems ? `\n${problems} email me dikkat hai` : '\nsab email theek hain');
process.exit(problems ? 1 : 0);
