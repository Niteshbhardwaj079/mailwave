import { useMemo } from 'react';

import { useApi } from '../../api/useApi';
import { useT } from '../../i18n/I18nProvider';
import { formatNumber } from '../../utils/format';

/**
 * "All Contacts" recipient source ka form — shehar/tag/group se chhaanto,
 * aur chaho to jinhe pehle email ja chuki hai unhe apne aap hata do.
 *
 * Campaign wizard (naya campaign) aur "Add more recipients" (chalti hui
 * campaign me aur log jodna), dono jagah se istemal hota hai — ek hi jagah
 * rakhne se dono kabhi alag nahi dikhte.
 */
export default function ContactFilterFields({ value, onChange, groups = [], count, counting }) {
  const t = useT();
  const citiesCall = useApi('/api/contacts/cities/all');
  const tagsCall = useApi('/api/contacts/tags/all');
  const cities = useMemo(() => citiesCall.data?.cities ?? [], [citiesCall.data]);
  const tags = useMemo(() => tagsCall.data?.tags ?? [], [tagsCall.data]);

  function handleField(event) {
    onChange({ [event.target.name]: event.target.value });
  }

  function handleExclude(event) {
    onChange({ excludeAlreadyEmailed: event.target.checked });
  }

  return (
    <div className="mw-stack--sm d-flex flex-column">
      <div className="row g-3">
        <div className="col-12">
          <label className="form-label" htmlFor="cf-search">
            {t('common.search')}
          </label>
          <input
            id="cf-search"
            name="search"
            type="text"
            className="form-control"
            value={value.search}
            onChange={handleField}
            placeholder={t('rec.filterSearchPlaceholder')}
          />
        </div>

        <div className="col-12 col-md-4">
          <label className="form-label" htmlFor="cf-city">
            {t('common.city')}
          </label>
          <select id="cf-city" name="city" className="form-select" value={value.city} onChange={handleField}>
            <option value="">{t('filter.allCities')}</option>
            {cities.map((city) => (
              <option key={city} value={city}>
                {city}
              </option>
            ))}
          </select>
        </div>

        <div className="col-12 col-md-4">
          <label className="form-label" htmlFor="cf-tag">
            {t('con.tags')}
          </label>
          <select id="cf-tag" name="tag" className="form-select" value={value.tag} onChange={handleField}>
            <option value="">{t('filter.allTags')}</option>
            {tags.map((tag) => (
              <option key={tag} value={tag}>
                {tag}
              </option>
            ))}
          </select>
        </div>

        <div className="col-12 col-md-4">
          <label className="form-label" htmlFor="cf-group">
            {t('con.group')}
          </label>
          <select id="cf-group" name="groupId" className="form-select" value={value.groupId} onChange={handleField}>
            <option value="">{t('filter.allGroups')}</option>
            {groups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="form-check">
        <input
          className="form-check-input"
          type="checkbox"
          id="cf-exclude"
          checked={value.excludeAlreadyEmailed}
          onChange={handleExclude}
        />
        <label className="form-check-label" htmlFor="cf-exclude">
          {t('rec.excludeAlreadyEmailed')}
        </label>
        <div className="form-text">{t('rec.excludeAlreadyEmailedHelp')}</div>
      </div>

      <div className="mw-note mw-note--info">
        <i className="bi bi-people mw-note__icon" aria-hidden="true" />
        <div>
          {counting
            ? t('common.loading')
            : t('rec.filterMatchCount', { count: formatNumber(count ?? 0) })}
        </div>
      </div>
    </div>
  );
}
