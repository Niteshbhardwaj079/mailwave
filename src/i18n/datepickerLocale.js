import { enGB } from 'date-fns/locale/en-GB';

/**
 * react-datepicker ke liye locale — mahine/din ke naam browser ke Intl se.
 *
 * date-fns me sirf kuch bhasha ke locale hain (Malayalam, Marathi, Punjabi
 * jaise kai nahi), aur har ek alag import karne se bundle bhi badhta. Intl har
 * bhasha ke naam pehle se jaanta hai — isliye 21 me se har bhasha ke liye ek
 * hi tarika. Sirf naam badalte hain; format (dd/MM/yyyy) sab jagah ek jaisa
 * rehta hai, taaki type karke tarikh dalna bhi har bhasha me chale.
 */
const WIDTH_TO_INTL = { wide: 'long', abbreviated: 'short', short: 'short', narrow: 'narrow' };

// In bhashaon me hafta Somvaar se shuru hota hai; baaki me Ravivaar se.
const MONDAY_FIRST = new Set(['de', 'fr', 'es', 'pt', 'ru']);

// Calendar ke din wale khane me jitna text bina ek-doosre par chadhe aa sakta hai
// (styles/_datepicker.scss: khana 32px + do taraf ka thoda khaali, 14px font par).
const HEADER_CELL_PX = 35;

const cache = new Map();

function makeFormatter(tag, options) {
  try {
    return new Intl.DateTimeFormat(tag, options);
  } catch {
    // Browser ko yeh tag pata hi nahi — English naam dikha do, toot mat.
    return new Intl.DateTimeFormat('en', options);
  }
}

/** Kuch browsers me kisi bhasha ka data adhoora hota hai (jaise Chrome me Punjabi: mahina "M09" aata hai). */
function intlHasRealMonthNames(tag) {
  return !/^M\d+$/.test(makeFormatter(tag, { month: 'long' }).format(new Date(2026, 8, 15)));
}

let measureContext = null;

/** Text ki asli chaudai (pixel me) — canvas se; na mile to 0 (matlab "kat-chhant mat karo"). */
function textWidth(text) {
  try {
    if (!measureContext) {
      measureContext = document.createElement('canvas').getContext('2d');
      measureContext.font = `600 14px ${getComputedStyle(document.body).fontFamily}`;
    }
    return measureContext.measureText(text).width;
  } catch {
    return 0;
  }
}

/**
 * Din ke chhote naam (Sun/Mon...) kai bhashaon me (Malayalam, Bengali, Thai,
 * Arabic...) khane se lambe hote hain aur ek-doosre par chadh jate hain. Aisi
 * bhasha me ek-do akshar wale "narrow" naam lete hain.
 */
function shortNamesTooWide(tag) {
  const formatter = makeFormatter(tag, { weekday: 'short' });
  const widest = Math.max(
    ...Array.from({ length: 7 }, (_, i) => textWidth(formatter.format(new Date(2000, 0, 2 + i))))
  );
  return widest > HEADER_CELL_PX;
}

export function datepickerLocale(languageCode, intlTag) {
  const key = `${languageCode}|${intlTag}`;
  if (cache.has(key)) return cache.get(key);

  const weekStartsOn = MONDAY_FIRST.has(languageCode) ? 1 : 0;
  let locale;

  if (!intlHasRealMonthNames(intlTag)) {
    locale = { ...enGB, options: { ...enGB.options, weekStartsOn } };
  } else {
    const narrowHeader = shortNamesTooWide(intlTag);
    locale = {
      ...enGB,
      code: intlTag,
      localize: {
        ...enGB.localize,
        month: (index, options) =>
          makeFormatter(intlTag, { month: WIDTH_TO_INTL[options?.width] || 'long' }).format(new Date(2000, index, 15)),
        // date-fns me din ka index Ravivaar = 0 hota hai; 2 Jan 2000 Ravivaar tha.
        day: (index, options) => {
          const width = options?.width;
          const style = narrowHeader && (width === 'short' || width === 'abbreviated') ? 'narrow' : WIDTH_TO_INTL[width] || 'long';
          return makeFormatter(intlTag, { weekday: style }).format(new Date(2000, 0, 2 + index));
        },
      },
      options: { ...enGB.options, weekStartsOn },
    };
  }

  cache.set(key, locale);
  return locale;
}
