import { useNavigate } from 'react-router-dom';

import StatusPill from '../ui/StatusPill';
import { formatDate, formatNumber, percent } from '../../utils/format';
import { useT } from '../../i18n/I18nProvider';

export default function CampaignTable({ items, showActions = false }) {
  const t = useT();
  const navigate = useNavigate();

  function openCampaign(event) {
    navigate(`/campaigns/${event.currentTarget.dataset.id}`);
  }

  return (
    <>
      <div className="mw-tablewrap">
        <table className="mw-table mw-table--clickable">
          <thead>
            <tr>
              <th scope="col">Campaign</th>
              <th scope="col" className="mw-table__num">{t('camp.recipients')}</th>
              <th scope="col" className="mw-table__num">Sent</th>
              <th scope="col" className="mw-table__num">Opened</th>
              <th scope="col" className="mw-table__num">Clicked</th>
              <th scope="col" className="mw-table__num">Failed</th>
              <th scope="col">Status</th>
              <th scope="col">Date</th>
              {showActions ? <th scope="col" className="text-end">Actions</th> : null}
            </tr>
          </thead>
          <tbody>
            {items.map((campaign) => (
              <tr key={campaign.id} data-id={campaign.id} onClick={openCampaign}>
                <td>
                  <div className="mw-table__primary">{campaign.name}</div>
                  <div className="mw-table__muted">{campaign.sender}</div>
                </td>
                <td className="mw-table__num">{formatNumber(campaign.recipients)}</td>
                <td className="mw-table__num">{formatNumber(campaign.sent)}</td>
                <td className="mw-table__num">
                  {formatNumber(campaign.opened)}
                  <span className="d-block mw-table__muted">{percent(campaign.opened, campaign.sent)}</span>
                </td>
                <td className="mw-table__num">
                  {formatNumber(campaign.clicked)}
                  <span className="d-block mw-table__muted">{percent(campaign.clicked, campaign.sent)}</span>
                </td>
                <td className="mw-table__num mw-text-danger">{formatNumber(campaign.failed)}</td>
                <td>
                  <StatusPill status={campaign.status} />
                </td>
                <td className="mw-nowrap mw-table__muted">{formatDate(campaign.date)}</td>
                {showActions ? (
                  <td className="text-end">
                    <span className="mw-iconbtn" aria-hidden="true">
                      <i className="bi bi-three-dots-vertical" />
                    </span>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mw-reclist">
        {items.map((campaign) => (
          <button key={campaign.id} type="button" className="mw-rec" data-id={campaign.id} onClick={openCampaign}>
            <div className="mw-rec__top">
              <span className="mw-rec__title">
                {campaign.name}
                <span className="d-block mw-rec__sub">{campaign.sender}</span>
              </span>
              <StatusPill status={campaign.status} />
            </div>

            <div className="mw-row mw-row--between mw-fs-12 mw-text-muted">
              <span>
                <i className="bi bi-people me-1" />
                {formatNumber(campaign.recipients)} recipients
              </span>
              <span>
                <i className="bi bi-calendar3 me-1" />
                {formatDate(campaign.date)}
              </span>
            </div>

            <div className="mw-rec__stats">
              <span className="mw-rec__stat">
                <span className="d-block mw-rec__statlabel">Sent</span>
                <span className="mw-rec__statvalue">{formatNumber(campaign.sent)}</span>
              </span>
              <span className="mw-rec__stat">
                <span className="d-block mw-rec__statlabel">Opened</span>
                <span className="mw-rec__statvalue mw-text-info">{formatNumber(campaign.opened)}</span>
              </span>
              <span className="mw-rec__stat">
                <span className="d-block mw-rec__statlabel">Clicked</span>
                <span className="mw-rec__statvalue mw-text-success">{formatNumber(campaign.clicked)}</span>
              </span>
              <span className="mw-rec__stat">
                <span className="d-block mw-rec__statlabel">Failed</span>
                <span className="mw-rec__statvalue mw-text-danger">{formatNumber(campaign.failed)}</span>
              </span>
            </div>
          </button>
        ))}
      </div>
    </>
  );
}
