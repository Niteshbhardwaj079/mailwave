import { useMemo, useState } from 'react';

import PageHeader from '../components/ui/PageHeader';
import { Card, CardFoot, CardHead } from '../components/ui/Card';
import { Note, SearchInput, Segmented } from '../components/ui/Controls';
import FilterSelect, { FilterBar } from '../components/ui/FilterSelect';
import StatusPill from '../components/ui/StatusPill';
import EmptyState from '../components/ui/EmptyState';
import Sheet from '../components/ui/Sheet';
import { useT } from '../i18n/I18nProvider';
import { useWorkspace } from '../store/WorkspaceProvider';
import { PERMISSION_ACTIONS, PERMISSION_MODULES, ROLE_ICONS, ROLE_TONES } from '../data/adminData';
import { roleDesc, roleLabel } from '../utils/roles';
import { initialsOf } from '../utils/format';

const EMPTY_USER = { name: '', email: '', role: '', department: '', status: 'Invited' };
const EMPTY_ROLE = { name: '', description: '', tone: 'primary', icon: 'bi-person', copyFrom: '' };

export default function UsersPage() {
  const t = useT();
  const {
    users,
    roles,
    saveUser,
    toggleUserStatus,
    setUserPassword,
    sendPasswordResetLink,
    createRole,
    updateRole,
    deleteRole,
    duplicateRole,
    togglePermission,
    setModulePermissions,
  } = useWorkspace();

  const [tab, setTab] = useState('people');
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedRole, setSelectedRole] = useState(roles[1]?.key || roles[0].key);
  const [editingUser, setEditingUser] = useState(null);
  const [editingRole, setEditingRole] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteBlocked, setDeleteBlocked] = useState(null);
  const [passwordFor, setPasswordFor] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [notifyUser, setNotifyUser] = useState(true);
  const [passwordError, setPasswordError] = useState('');
  const [passwordDone, setPasswordDone] = useState('');

  const labels = useMemo(
    () => roles.reduce((acc, role) => ({ ...acc, [role.key]: roleLabel(role, t) }), {}),
    [roles, t]
  );

  const filtered = useMemo(() => {
    const text = query.trim().toLowerCase();
    return users.filter((user) => {
      const roleOk = roleFilter === 'all' || user.role === roleFilter;
      const statusOk = statusFilter === 'all' || user.status === statusFilter;
      const textOk =
        !text ||
        user.name.toLowerCase().includes(text) ||
        user.email.toLowerCase().includes(text) ||
        (labels[user.role] || '').toLowerCase().includes(text);
      return roleOk && statusOk && textOk;
    });
  }, [users, query, roleFilter, statusFilter, labels]);

  // --- users ---------------------------------------------------------------
  function openNewUser() {
    setEditingUser({ ...EMPTY_USER, role: roles[roles.length - 1]?.key || '' });
  }

  function openEditUser(event) {
    setEditingUser(users.find((user) => user.id === event.currentTarget.dataset.id) || null);
  }

  function closeUser() {
    setEditingUser(null);
  }

  function handleUserField(event) {
    const { name, value } = event.target;
    setEditingUser((current) => ({ ...current, [name]: value }));
  }

  function submitUser() {
    if (!editingUser?.name || !editingUser?.email) return;
    saveUser({ ...editingUser, initials: editingUser.initials || initialsOf(editingUser.name) });
    setEditingUser(null);
  }

  function handleToggleStatus(event) {
    toggleUserStatus(event.currentTarget.dataset.id);
  }

  // --- passwords -----------------------------------------------------------
  function openPassword(event) {
    setPasswordFor(users.find((user) => user.id === event.currentTarget.dataset.id) || null);
    setNewPassword('');
    setConfirmPassword('');
    setNotifyUser(true);
    setPasswordError('');
    setPasswordDone('');
  }

  function closePassword() {
    setPasswordFor(null);
  }

  function handleNewPassword(event) {
    setNewPassword(event.target.value);
    setPasswordError('');
  }

  function handleConfirmPassword(event) {
    setConfirmPassword(event.target.value);
    setPasswordError('');
  }

  function handleNotify() {
    setNotifyUser((current) => !current);
  }

  function submitPassword() {
    if (newPassword.length < 8) {
      setPasswordError(t('auth.errShort'));
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError(t('auth.errMatch'));
      return;
    }
    setUserPassword(passwordFor.id, { notify: notifyUser });
    setPasswordDone(notifyUser ? t('users.pwdDoneEmail') : t('users.pwdDone'));
    setNewPassword('');
    setConfirmPassword('');
  }

  function sendResetLink() {
    sendPasswordResetLink(passwordFor.id);
    setPasswordDone(t('users.pwdLinkSent'));
  }

  // --- roles ---------------------------------------------------------------
  function openNewRole() {
    setEditingRole({ ...EMPTY_ROLE });
  }

  function openEditRole(event) {
    event.stopPropagation();
    const role = roles.find((item) => item.key === event.currentTarget.dataset.key);
    if (!role) return;
    setEditingRole({
      key: role.key,
      name: roleLabel(role, t),
      description: roleDesc(role, t),
      tone: role.tone,
      icon: role.icon || 'bi-person',
      copyFrom: '',
    });
  }

  function closeRole() {
    setEditingRole(null);
  }

  function handleRoleField(event) {
    const { name, value } = event.target;
    setEditingRole((current) => ({ ...current, [name]: value }));
  }

  function handleRoleTone(event) {
    setEditingRole((current) => ({ ...current, tone: event.currentTarget.dataset.tone }));
  }

  function handleRoleIcon(event) {
    setEditingRole((current) => ({ ...current, icon: event.currentTarget.dataset.icon }));
  }

  function submitRole() {
    if (!editingRole?.name.trim()) return;

    if (editingRole.key) {
      updateRole(editingRole.key, editingRole);
    } else {
      const created = createRole(editingRole);
      setSelectedRole(created.key);
    }
    setEditingRole(null);
  }

  function handleDuplicateRole(event) {
    event.stopPropagation();
    const copy = duplicateRole(event.currentTarget.dataset.key);
    if (copy) setSelectedRole(copy.key);
  }

  function askDeleteRole(event) {
    event.stopPropagation();
    setDeleteTarget(roles.find((item) => item.key === event.currentTarget.dataset.key) || null);
  }

  function closeDeleteRole() {
    setDeleteTarget(null);
    setDeleteBlocked(null);
  }

  function confirmDeleteRole() {
    if (!deleteTarget) return;
    const result = deleteRole(deleteTarget.key);

    if (!result.ok) {
      setDeleteBlocked(result);
      return;
    }

    if (selectedRole === deleteTarget.key) setSelectedRole(roles[0].key);
    setDeleteTarget(null);
    setDeleteBlocked(null);
  }

  function pickRole(event) {
    setSelectedRole(event.currentTarget.dataset.key);
  }

  function handlePermission(event) {
    const { module, action } = event.currentTarget.dataset;
    togglePermission(selectedRole, module, action);
  }

  function handleSelectAllRow(event) {
    const { module } = event.currentTarget.dataset;
    const definition = PERMISSION_MODULES.find((item) => item.key === module);
    const role = roles.find((item) => item.key === selectedRole);
    const current = role.permissions[module] || [];
    const allOn = definition.actions.every((action) => current.includes(action));
    setModulePermissions(selectedRole, module, allOn ? [] : [...definition.actions]);
  }

  function clearFilters() {
    setQuery('');
    setRoleFilter('all');
    setStatusFilter('all');
  }

  const role = roles.find((item) => item.key === selectedRole) || roles[0];
  const roleIsEmpty = PERMISSION_MODULES.every((module) => (role.permissions[module.key] || []).length === 0);

  return (
    <div className="mw-stack">
      <PageHeader
        title={t('users.title')}
        subtitle={t('users.subtitle')}
        helpTopic="users"
        actions={
          tab === 'people' ? (
            <button type="button" className="btn btn-primary mw-btn-block-mobile" onClick={openNewUser}>
              <i className="bi bi-person-plus me-2" />
              {t('users.add')}
            </button>
          ) : (
            <button type="button" className="btn btn-primary mw-btn-block-mobile" onClick={openNewRole}>
              <i className="bi bi-plus-lg me-2" />
              {t('users.addRole')}
            </button>
          )
        }
      />

      <Segmented
        items={[
          { value: 'people', label: t('users.tabUsers') },
          { value: 'roles', label: t('users.tabRoles') },
        ]}
        value={tab}
        onChange={setTab}
        ariaLabel={t('users.title')}
      />

      {tab === 'people' ? (
        <Card flush>
          <FilterBar onClear={clearFilters} clearLabel={t('common.clear')}>
            <div className="mw-filterbar__search">
              <SearchInput value={query} onChange={setQuery} placeholder={t('users.searchPlaceholder')} />
            </div>
            <FilterSelect
              id="user-filter-role"
              label={t('common.role')}
              icon="bi-person-badge"
              value={roleFilter}
              onChange={setRoleFilter}
              options={[
                { value: 'all', label: t('common.all') },
                ...roles.map((item) => ({ value: item.key, label: labels[item.key] })),
              ]}
            />
            <FilterSelect
              id="user-filter-status"
              label={t('common.status')}
              icon="bi-toggle-on"
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { value: 'all', label: t('filter.allStatuses') },
                { value: 'Active', label: 'Active' },
                { value: 'Invited', label: 'Invited' },
                { value: 'Disabled', label: 'Disabled' },
              ]}
            />
          </FilterBar>

          {filtered.length === 0 ? (
            <EmptyState icon="bi-people" title={t('common.noResults')} text={t('common.noResultsText')} />
          ) : (
            <>
              <div className="mw-tablewrap">
                <table className="mw-table">
                  <thead>
                    <tr>
                      <th scope="col">{t('common.name')}</th>
                      <th scope="col">{t('common.email')}</th>
                      <th scope="col">{t('common.role')}</th>
                      <th scope="col">Department</th>
                      <th scope="col">{t('common.status')}</th>
                      <th scope="col">{t('users.lastActive')}</th>
                      <th scope="col" className="text-end">{t('common.actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((user) => (
                      <tr key={user.id}>
                        <td>
                          <div className="mw-cellstack">
                            <span className="mw-avatar mw-avatar--sm">{user.initials || initialsOf(user.name)}</span>
                            <span className="mw-table__primary">{user.name}</span>
                          </div>
                        </td>
                        <td className="mw-table__muted">{user.email}</td>
                        <td>
                          <StatusPill
                            status={labels[user.role] || user.role}
                            tone={roles.find((item) => item.key === user.role)?.tone || 'muted'}
                          />
                        </td>
                        <td className="mw-table__muted">{user.department || '—'}</td>
                        <td>
                          <StatusPill
                            status={user.status}
                            tone={user.status === 'Active' ? 'success' : user.status === 'Invited' ? 'warning' : 'muted'}
                          />
                        </td>
                        <td className="mw-table__muted mw-nowrap">{user.lastActive}</td>
                        <td className="text-end mw-nowrap">
                          <button
                            type="button"
                            className="mw-iconbtn"
                            data-id={user.id}
                            onClick={openEditUser}
                            aria-label={`${t('common.edit')} ${user.name}`}
                          >
                            <i className="bi bi-pencil" />
                          </button>
                          <button
                            type="button"
                            className="mw-iconbtn"
                            data-id={user.id}
                            onClick={openPassword}
                            aria-label={t('users.password')}
                            title={t('users.password')}
                          >
                            <i className="bi bi-key" />
                          </button>
                          <button
                            type="button"
                            className="mw-iconbtn"
                            data-id={user.id}
                            onClick={handleToggleStatus}
                            aria-label={user.status === 'Disabled' ? t('users.activate') : t('users.deactivate')}
                          >
                            <i className={`bi ${user.status === 'Disabled' ? 'bi-toggle-off' : 'bi-toggle-on'}`} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mw-reclist p-3">
                {filtered.map((user) => (
                  <div key={user.id} className="mw-rec">
                    <div className="mw-rec__top">
                      <span className="mw-avatar mw-avatar--sm">{user.initials || initialsOf(user.name)}</span>
                      <span className="mw-rec__title">
                        {user.name}
                        <span className="d-block mw-rec__sub">{user.email}</span>
                      </span>
                      <StatusPill
                        status={user.status}
                        tone={user.status === 'Active' ? 'success' : user.status === 'Invited' ? 'warning' : 'muted'}
                      />
                    </div>
                    <div className="mw-row mw-row--between">
                      <StatusPill
                        status={labels[user.role] || user.role}
                        tone={roles.find((item) => item.key === user.role)?.tone || 'muted'}
                      />
                      <span className="mw-row">
                        <button type="button" className="btn btn-sm btn-outline-secondary" data-id={user.id} onClick={openEditUser}>
                          {t('common.edit')}
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-secondary"
                          data-id={user.id}
                          onClick={openPassword}
                          aria-label={t('users.password')}
                        >
                          <i className="bi bi-key" />
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-secondary"
                          data-id={user.id}
                          onClick={handleToggleStatus}
                        >
                          {user.status === 'Disabled' ? t('users.activate') : t('users.deactivate')}
                        </button>
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          <CardFoot>
            <span className="mw-fs-12 mw-text-muted">
              {t('common.showing')} {filtered.length} {t('common.of')} {users.length}
            </span>
          </CardFoot>
        </Card>
      ) : null}

      {tab === 'roles' ? (
        <div className="mw-stack--sm d-flex flex-column">
          <Note tone="primary" icon="bi-sliders">
            {t('users.rolesIntro')}
          </Note>

          <div className="mw-optiongrid">
            {roles.map((item) => (
              <div
                key={item.key}
                data-key={item.key}
                onClick={pickRole}
                role="button"
                tabIndex={0}
                className={`mw-rolecard ${selectedRole === item.key ? 'is-selected' : ''}`.trim()}
              >
                <span className={`mw-rolecard__icon mw-kpi__icon--${item.tone}`} aria-hidden="true">
                  <i className={`bi ${item.icon || 'bi-person'}`} />
                </span>

                <span className="flex-grow-1 min-w-0">
                  <span className="d-block mw-option__title">
                    {roleLabel(item, t)}
                    {item.locked ? <i className="bi bi-lock-fill mw-fs-11 mw-text-muted-2 ms-2" /> : null}
                  </span>
                  <span className="d-block mw-option__desc">{roleDesc(item, t)}</span>
                  <span className="d-block mw-fs-12 mw-text-muted mt-2">
                    {users.filter((user) => user.role === item.key).length} {t('users.peopleWithRole')}
                  </span>
                </span>

                <span className="mw-rolecard__tools">
                  <button
                    type="button"
                    className="mw-iconbtn"
                    data-key={item.key}
                    onClick={handleDuplicateRole}
                    aria-label={t('users.duplicateRole')}
                    title={t('users.duplicateRole')}
                  >
                    <i className="bi bi-files" />
                  </button>
                  {item.locked ? null : (
                    <>
                      <button
                        type="button"
                        className="mw-iconbtn"
                        data-key={item.key}
                        onClick={openEditRole}
                        aria-label={t('users.editRole')}
                        title={t('users.editRole')}
                      >
                        <i className="bi bi-pencil" />
                      </button>
                      <button
                        type="button"
                        className="mw-iconbtn mw-text-danger"
                        data-key={item.key}
                        onClick={askDeleteRole}
                        aria-label={t('users.deleteRole')}
                        title={t('users.deleteRole')}
                      >
                        <i className="bi bi-trash3" />
                      </button>
                    </>
                  )}
                </span>
              </div>
            ))}

            <button type="button" className="mw-rolecard mw-rolecard--add" onClick={openNewRole}>
              <span className="mw-rolecard__icon mw-kpi__icon--primary" aria-hidden="true">
                <i className="bi bi-plus-lg" />
              </span>
              <span>
                <span className="d-block mw-option__title">{t('users.addRole')}</span>
                <span className="d-block mw-option__desc">{t('users.startFromHelp')}</span>
              </span>
            </button>
          </div>

          <Card flush>
            <CardHead
              title={`${t('users.permissionsFor')} ${roleLabel(role, t)}`}
              subtitle={role.locked ? t('users.roleLocked') : t('users.permissionHelp')}
            />

            {roleIsEmpty && !role.locked ? (
              <div className="mw-card__body pb-0">
                <Note tone="warning" icon="bi-exclamation-triangle">
                  {t('users.noRolePermissions')}
                </Note>
              </div>
            ) : null}

            <div className="mw-tablewrap">
              <table className="mw-permtable">
                <thead>
                  <tr>
                    <th scope="col">{t('users.section')}</th>
                    {PERMISSION_ACTIONS.map((action) => (
                      <th key={action.key} scope="col">
                        {t(action.labelKey)}
                      </th>
                    ))}
                    <th scope="col">{t('users.selectAll')}</th>
                  </tr>
                </thead>
                <tbody>
                  {PERMISSION_MODULES.map((module) => {
                    const allowed = role.permissions[module.key] || [];
                    const allOn = module.actions.every((action) => allowed.includes(action));

                    return (
                      <tr key={module.key}>
                        <td>
                          <span className="mw-permtable__module">
                            <i className={`bi ${module.icon}`} aria-hidden="true" />
                            {t(module.labelKey)}
                          </span>
                        </td>

                        {PERMISSION_ACTIONS.map((action) => {
                          if (!module.actions.includes(action.key)) {
                            return (
                              <td key={action.key}>
                                <span className="mw-permdash" aria-hidden="true">
                                  –
                                </span>
                              </td>
                            );
                          }
                          return (
                            <td key={action.key}>
                              <input
                                type="checkbox"
                                className="form-check-input mw-permcheck"
                                checked={allowed.includes(action.key)}
                                disabled={role.locked}
                                data-module={module.key}
                                data-action={action.key}
                                onChange={handlePermission}
                                aria-label={`${t(action.labelKey)} — ${t(module.labelKey)}`}
                              />
                            </td>
                          );
                        })}

                        <td>
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-secondary"
                            data-module={module.key}
                            onClick={handleSelectAllRow}
                            disabled={role.locked}
                          >
                            {allOn ? <i className="bi bi-x-lg" /> : <i className="bi bi-check-all" />}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <CardFoot>
              <span className="mw-fs-12 mw-text-muted">{t('users.roleNote')}</span>
            </CardFoot>
          </Card>
        </div>
      ) : null}

      {/* ---------------- user sheet ---------------- */}
      <Sheet
        open={Boolean(editingUser)}
        title={editingUser?.id ? t('users.editUser') : t('users.newUser')}
        onClose={closeUser}
        footer={
          <>
            <button type="button" className="btn btn-outline-secondary flex-fill" onClick={closeUser}>
              {t('common.cancel')}
            </button>
            <button type="button" className="btn btn-primary flex-fill" onClick={submitUser}>
              {editingUser?.id ? t('common.saveChanges') : t('users.invite')}
            </button>
          </>
        }
      >
        {editingUser ? (
          <div className="row g-3">
            <div className="col-12 col-md-6">
              <label className="form-label" htmlFor="user-name">
                {t('common.name')}
              </label>
              <input
                id="user-name"
                name="name"
                type="text"
                className="form-control"
                value={editingUser.name}
                onChange={handleUserField}
                placeholder="Neha Kulkarni"
              />
            </div>
            <div className="col-12 col-md-6">
              <label className="form-label" htmlFor="user-email">
                {t('common.email')}
              </label>
              <input
                id="user-email"
                name="email"
                type="email"
                className="form-control"
                value={editingUser.email}
                onChange={handleUserField}
                placeholder="neha@yourcompany.com"
              />
            </div>
            <div className="col-12 col-md-6">
              <label className="form-label" htmlFor="user-role">
                {t('common.role')}
              </label>
              <select id="user-role" name="role" className="form-select" value={editingUser.role} onChange={handleUserField}>
                {roles.map((item) => (
                  <option key={item.key} value={item.key}>
                    {roleLabel(item, t)}
                  </option>
                ))}
              </select>
              <div className="form-text">
                {roleDesc(roles.find((item) => item.key === editingUser.role), t)}
              </div>
            </div>
            <div className="col-12 col-md-6">
              <label className="form-label" htmlFor="user-department">
                Department
              </label>
              <input
                id="user-department"
                name="department"
                type="text"
                className="form-control"
                value={editingUser.department}
                onChange={handleUserField}
                placeholder={t('users.deptPlaceholder')}
              />
            </div>
          </div>
        ) : null}
      </Sheet>

      {/* ---------------- role sheet ---------------- */}
      <Sheet
        open={Boolean(editingRole)}
        title={editingRole?.key ? t('users.editRole') : t('users.addRole')}
        onClose={closeRole}
        footer={
          <>
            <button type="button" className="btn btn-outline-secondary flex-fill" onClick={closeRole}>
              {t('common.cancel')}
            </button>
            <button type="button" className="btn btn-primary flex-fill" onClick={submitRole}>
              {editingRole?.key ? t('common.saveChanges') : t('users.createRole')}
            </button>
          </>
        }
      >
        {editingRole ? (
          <div className="mw-stack--sm d-flex flex-column">
            <div>
              <label className="form-label" htmlFor="role-name">
                {t('users.roleName')}
              </label>
              <input
                id="role-name"
                name="name"
                type="text"
                className="form-control form-control-lg"
                value={editingRole.name}
                onChange={handleRoleField}
                placeholder={t('users.roleNamePlaceholder')}
              />
            </div>

            <div>
              <label className="form-label" htmlFor="role-description">
                {t('users.roleDescription')}
              </label>
              <textarea
                id="role-description"
                name="description"
                className="form-control"
                rows={2}
                value={editingRole.description}
                onChange={handleRoleField}
                placeholder={t('users.roleDescriptionPlaceholder')}
              />
            </div>

            <div>
              <span className="form-label d-block">{t('users.roleColour')}</span>
              <div className="mw-row mw-row--wrap">
                {ROLE_TONES.map((tone) => (
                  <button
                    key={tone}
                    type="button"
                    data-tone={tone}
                    onClick={handleRoleTone}
                    aria-label={tone}
                    className={`mw-tonedot mw-kpi__icon--${tone} ${editingRole.tone === tone ? 'is-active' : ''}`.trim()}
                  >
                    {editingRole.tone === tone ? <i className="bi bi-check-lg" /> : null}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <span className="form-label d-block">{t('users.roleIcon')}</span>
              <div className="mw-row mw-row--wrap">
                {ROLE_ICONS.map((icon) => (
                  <button
                    key={icon}
                    type="button"
                    data-icon={icon}
                    onClick={handleRoleIcon}
                    aria-label={icon}
                    className={`mw-iconpick ${editingRole.icon === icon ? 'is-active' : ''}`.trim()}
                  >
                    <i className={`bi ${icon}`} />
                  </button>
                ))}
              </div>
            </div>

            {editingRole.key ? null : (
              <div>
                <label className="form-label" htmlFor="role-copy">
                  {t('users.startFrom')}
                </label>
                <select
                  id="role-copy"
                  name="copyFrom"
                  className="form-select"
                  value={editingRole.copyFrom}
                  onChange={handleRoleField}
                >
                  <option value="">{t('users.startFromBlank')}</option>
                  {roles.map((item) => (
                    <option key={item.key} value={item.key}>
                      {roleLabel(item, t)}
                    </option>
                  ))}
                </select>
                <div className="form-text">{t('users.startFromHelp')}</div>
              </div>
            )}
          </div>
        ) : null}
      </Sheet>


      {/* ---------------- password sheet ---------------- */}
      <Sheet
        open={Boolean(passwordFor)}
        title={t('users.password')}
        onClose={closePassword}
        footer={
          <>
            <button type="button" className="btn btn-outline-secondary flex-fill" onClick={closePassword}>
              {t('common.close')}
            </button>
            <button type="button" className="btn btn-primary flex-fill" onClick={submitPassword}>
              {t('users.setPassword')}
            </button>
          </>
        }
      >
        {passwordFor ? (
          <div className="mw-stack--sm d-flex flex-column">
            <div className="mw-row">
              <span className="mw-avatar">{passwordFor.initials || initialsOf(passwordFor.name)}</span>
              <span>
                <span className="d-block mw-fs-15 mw-fw-700">{passwordFor.name}</span>
                <span className="d-block mw-fs-12 mw-text-muted">{passwordFor.email}</span>
              </span>
            </div>

            <Note tone="info" icon="bi-shield-lock">
              {t('users.pwdNote')}
            </Note>

            {passwordError ? (
              <div className="mw-note mw-note--warning" role="alert">
                <i className="bi bi-exclamation-triangle mw-note__icon" aria-hidden="true" />
                <div>{passwordError}</div>
              </div>
            ) : null}

            {passwordDone ? (
              <div className="mw-note mw-note--success" role="status">
                <i className="bi bi-check-circle mw-note__icon" aria-hidden="true" />
                <div>{passwordDone}</div>
              </div>
            ) : null}

            <div>
              <label className="form-label" htmlFor="admin-new-password">
                {t('auth.newPassword')}
              </label>
              <input
                id="admin-new-password"
                type="password"
                className="form-control"
                value={newPassword}
                onChange={handleNewPassword}
                autoComplete="new-password"
              />
            </div>

            <div>
              <label className="form-label" htmlFor="admin-confirm-password">
                {t('auth.confirmPassword')}
              </label>
              <input
                id="admin-confirm-password"
                type="password"
                className="form-control"
                value={confirmPassword}
                onChange={handleConfirmPassword}
                autoComplete="new-password"
              />
            </div>

            <div className="form-check">
              <input
                className="form-check-input"
                type="checkbox"
                id="notify-user"
                checked={notifyUser}
                onChange={handleNotify}
              />
              <label className="form-check-label mw-fs-13" htmlFor="notify-user">
                {t('users.pwdNotify')}
              </label>
            </div>

            <hr className="my-2" />

            <div>
              <p className="mw-fs-13 mw-fw-650 mb-1">{t('users.pwdLinkTitle')}</p>
              <p className="mw-fs-12 mw-text-muted mb-2">{t('users.pwdLinkText')}</p>
              <button type="button" className="btn btn-outline-primary btn-sm" onClick={sendResetLink}>
                <i className="bi bi-envelope-arrow-up me-2" />
                {t('users.pwdSendLink')}
              </button>
            </div>
          </div>
        ) : null}
      </Sheet>

      {/* ---------------- delete role ---------------- */}
      <Sheet
        open={Boolean(deleteTarget)}
        title={deleteBlocked ? t('users.roleInUse') : t('users.deleteRoleConfirm')}
        onClose={closeDeleteRole}
        footer={
          deleteBlocked ? (
            <button type="button" className="btn btn-primary flex-fill" onClick={closeDeleteRole}>
              {t('common.close')}
            </button>
          ) : (
            <>
              <button type="button" className="btn btn-outline-secondary flex-fill" onClick={closeDeleteRole}>
                {t('common.cancel')}
              </button>
              <button type="button" className="btn btn-danger flex-fill" onClick={confirmDeleteRole}>
                {t('common.delete')}
              </button>
            </>
          )
        }
      >
        {deleteTarget ? (
          <p className="mw-fs-14 mb-0">
            <strong>{roleLabel(deleteTarget, t)}</strong> —{' '}
            {deleteBlocked
              ? `${deleteBlocked.count} ${t('users.roleInUseText')}`
              : t('users.deleteRoleText')}
          </p>
        ) : null}
      </Sheet>
    </div>
  );
}
