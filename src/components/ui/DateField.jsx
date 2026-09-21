import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import DatePicker from 'react-datepicker';

import { datepickerLocale } from '../../i18n/datepickerLocale';
import { useI18n } from '../../i18n/I18nProvider';

const DATE_FORMAT = 'dd/MM/yyyy';
const DATETIME_FORMAT = 'dd/MM/yyyy HH:mm';

function pad(n) {
  return String(n).padStart(2, '0');
}

/**
 * 'YYYY-MM-DD' ya 'YYYY-MM-DDTHH:mm' ko user ke apne time zone ki Date banata hai.
 *
 * `new Date('2026-09-05')` use UTC padhta hai — kuch time zone me din ek din
 * peeche khisak jata. Isliye hisse todkar local Date banate hain.
 */
function parseFieldValue(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/.exec(String(value || ''));
  if (!match) return null;
  const [, year, month, day, hour = '0', minute = '0'] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute));
  return Number.isNaN(date.getTime()) ? null : date;
}

/** parseFieldValue() ka ulta — state me wahi purana string roop rehta hai. */
function formatFieldValue(date, withTime) {
  const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  return withTime ? `${day}T${pad(date.getHours())}:${pad(date.getMinutes())}` : day;
}

/**
 * Poori app me tarikh/waqt chunne ka EK hi tareeka — browser ka apna calendar
 * (jo alag-alag browser me alag dikhta tha) nahi.
 *
 * Value hamesha wahi string hai jo pehle native input deta tha —
 *   withTime=false: 'YYYY-MM-DD'      withTime=true: 'YYYY-MM-DDTHH:mm'
 * (khaali ho to ''). Isliye har jagah baaki code jaisa tha waisa hi chalta hai.
 * `min`/`max` bhi wahi string roop lete hain.
 */
export default function DateField({
  id,
  value,
  onChange,
  withTime = false,
  min,
  max,
  className = 'form-control',
  placeholder,
  clearable = false,
}) {
  const { t, code, locale } = useI18n();

  // Sheet (dialog) Escape ko document par sabse pehle pakadta hai aur poora
  // dialog band kar deta hai — calendar khula ho tab Escape sirf calendar
  // band kare, dialog nahi. Isliye calendar khulne par window par (document se
  // bhi pehle) apna Escape sunte hain, calendar band karte hain aur aage nahi
  // jaane dete.
  const pickerRef = useRef(null);
  const [calendarOpen, setCalendarOpen] = useState(false);
  useEffect(() => {
    if (!calendarOpen) return undefined;
    function handleEscape(event) {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      pickerRef.current?.setOpen(false);
    }
    window.addEventListener('keydown', handleEscape, true);
    return () => window.removeEventListener('keydown', handleEscape, true);
  }, [calendarOpen]);

  const selected = parseFieldValue(value);
  const minDate = parseFieldValue(min);
  const maxDate = parseFieldValue(max);

  function handleChange(date) {
    onChange(date ? formatFieldValue(date, withTime) : '');
  }

  // Din ke andar bhi beeta hua waqt na chune (jaise aaj ka gujra hua ghanta).
  function allowTime(time) {
    return !minDate || time.getTime() >= minDate.getTime();
  }

  return (
    <DatePicker
      ref={pickerRef}
      onCalendarOpen={() => setCalendarOpen(true)}
      onCalendarClose={() => setCalendarOpen(false)}
      id={id}
      selected={selected}
      onChange={handleChange}
      locale={datepickerLocale(code, locale)}
      dateFormat={withTime ? DATETIME_FORMAT : DATE_FORMAT}
      placeholderText={placeholder ?? (withTime ? 'dd/mm/yyyy hh:mm' : 'dd/mm/yyyy')}
      minDate={minDate ?? undefined}
      maxDate={maxDate ?? undefined}
      showTimeSelect={withTime}
      timeFormat="HH:mm"
      timeIntervals={5}
      timeCaption={t('common.time')}
      filterTime={withTime ? allowTime : undefined}
      showMonthDropdown
      showYearDropdown
      dropdownMode="select"
      isClearable={clearable}
      className={className}
      wrapperClassName="mw-datefield"
      popperClassName="mw-datepopper"
      showPopperArrow={false}
      // Sheet ya scroll wale dabbe ke andar khulne par kat na jaye — seedha
      // page ke upar alag se dikhta hai.
      popperContainer={({ children }) => createPortal(children, document.body)}
      // Dialog khulte hi pehla field focus hota hai — us par calendar apne
      // aap na khule; click ya Enter/Neeche-teer se hi khule.
      preventOpenOnFocus
      autoComplete="off"
    />
  );
}
