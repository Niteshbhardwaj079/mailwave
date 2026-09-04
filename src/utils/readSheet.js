/**
 * Excel ya CSV file ko padh kar rows me badalta hai.
 *
 * Lautata hai: { headers: ['Name','Email',...], rows: [{Name:'...', Email:'...'}, ...] }
 *
 * Do tarah ki file chalti hain:
 *   .csv        — yahin padh lete hain, koi library nahi lagti
 *   .xlsx/.xls  — ExcelJS se, jo sirf tabhi load hoti hai jab zarurat pade
 *
 * ExcelJS ko "zarurat par" load karne ki wajah: wo lagbhag 1 MB ki hai. Har
 * user ko har page par utni file download karana galat hai, jabki import to
 * kabhi-kabhi hi hota hai.
 */

/**
 * CSV ki ek line ko todta hai.
 *
 * Seedha `line.split(',')` kaam nahi karta: "Verma Traders, Mumbai" jaisi
 * value quotes ke andar hoti hai aur usme comma bhi hota hai. Isliye ek-ek
 * akshar dekh kar aage badhte hain aur quotes ka hisaab rakhte hain.
 */
function splitCsvLine(line) {
  const out = [];
  let value = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];

    if (inQuotes) {
      // Do quote ek saath ("") ka matlab hai ek asli quote.
      if (ch === '"' && line[i + 1] === '"') {
        value += '"';
        i += 1;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        value += ch;
      }
      continue;
    }

    if (ch === '"') inQuotes = true;
    else if (ch === ',') {
      out.push(value.trim());
      value = '';
    } else value += ch;
  }

  out.push(value.trim());
  return out;
}

/** Poori CSV file ko rows me badalta hai. */
function parseCsv(text) {
  // Windows ki files me line ke ant me \r bhi hota hai — use hata dete hain,
  // warna aakhri column ki har value ke peeche ek chhupa hua akshar reh jata.
  const lines = text
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .filter((line) => line.trim() !== '');

  if (lines.length === 0) return { headers: [], rows: [] };

  const headers = splitCsvLine(lines[0]).map((h) => h.trim());

  const rows = lines.slice(1).map((line) => {
    const cells = splitCsvLine(line);
    return headers.reduce((row, header, index) => ({ ...row, [header]: cells[index] ?? '' }), {});
  });

  return { headers, rows };
}

/** Excel file ko rows me badalta hai. */
async function parseExcel(file) {
  // Zarurat par hi load hoti hai — page khulte hi nahi.
  const ExcelJS = (await import('exceljs')).default;

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await file.arrayBuffer());

  // Pehli sheet hi lete hain. Zyadatar logon ki file me ek hi sheet hoti hai,
  // aur jinme zyada hoti hain unme bhi asli list pehli hi hoti hai.
  const sheet = workbook.worksheets[0];
  if (!sheet) return { headers: [], rows: [] };

  const headers = [];
  const rows = [];

  sheet.eachRow((row, rowNumber) => {
    // ExcelJS me column 1 se shuru hote hain, isliye values[0] khali hota hai.
    const cells = (row.values ?? []).slice(1).map((cell) => cellText(cell));

    if (rowNumber === 1) {
      headers.push(...cells.map((h) => String(h).trim()));
      return;
    }

    // Poori khali line chhod dete hain — Excel me aksar niche khali rows reh
    // jati hain aur wo "invalid row" ban kar report gandi kar deti hain.
    if (cells.every((cell) => String(cell).trim() === '')) return;

    rows.push(headers.reduce((out, header, index) => ({ ...out, [header]: cells[index] ?? '' }), {}));
  });

  return { headers, rows };
}

/**
 * Excel ke ek khane ko saaf text me badalta hai.
 *
 * Khana sirf text nahi hota — email hyperlink ban jata hai, date object hoti
 * hai, formula ka jawab alag jagah rakha hota hai. Bina iske screen par
 * "[object Object]" dikhta.
 */
function cellText(cell) {
  if (cell === null || cell === undefined) return '';
  if (typeof cell !== 'object') return String(cell);

  if (cell instanceof Date) return cell.toISOString().slice(0, 10);
  if (cell.text) return String(cell.text); // hyperlink
  if (cell.result !== undefined) return String(cell.result); // formula ka jawab
  if (cell.richText) return cell.richText.map((part) => part.text).join('');

  return '';
}

/** File ka naam dekh kar sahi tarika chunta hai. */
export async function readSheet(file) {
  if (/\.csv$/i.test(file.name)) {
    return parseCsv(await file.text());
  }
  return parseExcel(file);
}

export default readSheet;
