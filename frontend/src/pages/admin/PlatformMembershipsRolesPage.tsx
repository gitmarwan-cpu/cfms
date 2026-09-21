import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import type { ApiClientError } from '../../api/axiosClient';
import {
  addPlatformTenantMembership,
  assignPlatformTenantRole,
  changePlatformTenantRole,
  deactivatePlatformTenantMembership,
  fetchMembershipUserOptions,
  fetchPlatformTenantMemberships,
  fetchPlatformTenantOrganizationNodes,
  fetchPlatformTenantRoles,
  fetchPlatformTenants,
  setPlatformTenantPrimaryMembership,
  type PlatformTenantDirectoryItem,
  type PlatformTenantMembership,
  type PlatformTenantOrganizationNode,
  type PlatformTenantRole,
  type MembershipUserOption,
} from '../../api/platformApi';
import { ConfirmDialog, DataState, FormDialog } from '../../components/admin/AdminUi';
import DataTable, { type DataTableColumn } from '../../components/admin/ui/DataTable';
import FilterBar from '../../components/patterns/FilterBar';
import Pagination from '../../components/patterns/Pagination';
import { PageHeader } from '../../components/patterns/PageHeader';
import SearchInput from '../../components/patterns/SearchInput';
import { Input, Select } from '../../components/ui/FormField';
import { StatusBadge } from '../../components/ui/StatusBadge';

const PAGE_LIMIT = 20;

type MembershipAction = {
  type: 'reactivate' | 'deactivate' | 'primary';
  membership: PlatformTenantMembership;
};

type RoleDialogState = {
  membership: PlatformTenantMembership;
  assignmentId: number | null;
};

const getErrorMessage = (error: unknown, fallback: string) =>
  (error as ApiClientError)?.message || fallback;

const roleName = (role: PlatformTenantMembership['tenantRoles'][number]['role']) =>
  role.nameAr || role.nameEn || role.code;

const nodeName = (node: PlatformTenantOrganizationNode) =>
  node.shortName || node.name || node.code || String(node.id);

export default function PlatformMembershipsRolesPage() {
  const [tenants, setTenants] = useState<PlatformTenantDirectoryItem[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState<number | null>(null);
  const [tenantsLoading, setTenantsLoading] = useState(true);
  const [tenantsError, setTenantsError] = useState('');
  const [tenantPage, setTenantPage] = useState(1);
  const [tenantSearchInput, setTenantSearchInput] = useState('');
  const [tenantSearch, setTenantSearch] = useState('');
  const [tenantPagination, setTenantPagination] = useState<Awaited<ReturnType<typeof fetchPlatformTenants>>['pagination'] | null>(null);

  const [memberships, setMemberships] = useState<PlatformTenantMembership[]>([]);
  const [roles, setRoles] = useState<PlatformTenantRole[]>([]);
  const [nodes, setNodes] = useState<PlatformTenantOrganizationNode[]>([]);
  const [pagination, setPagination] = useState<Awaited<ReturnType<typeof fetchPlatformTenantMemberships>>['pagination'] | null>(null);
  const [membershipsLoading, setMembershipsLoading] = useState(false);
  const [membershipsError, setMembershipsError] = useState('');
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');

  const [users, setUsers] = useState<MembershipUserOption[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState('');
  const [userPage, setUserPage] = useState(1);
  const [userSearchInput, setUserSearchInput] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [userPagination, setUserPagination] = useState<Awaited<ReturnType<typeof fetchMembershipUserOptions>>['pagination'] | null>(null);
  const [membershipDialogOpen, setMembershipDialogOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [membershipSaving, setMembershipSaving] = useState(false);
  const [membershipFormError, setMembershipFormError] = useState('');

  const [pendingAction, setPendingAction] = useState<MembershipAction | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState('');

  const [roleDialog, setRoleDialog] = useState<RoleDialogState | null>(null);
  const [roleId, setRoleId] = useState('');
  const [nodeId, setNodeId] = useState('');
  const [roleSaving, setRoleSaving] = useState(false);
  const [roleFormError, setRoleFormError] = useState('');

  const loadTenants = useCallback(async () => {
    setTenantsLoading(true);
    setTenantsError('');
    try {
      const response = await fetchPlatformTenants({
        page: tenantPage,
        limit: PAGE_LIMIT,
        search: tenantSearch.trim() || undefined,
      });
      setTenants(response.data);
      setTenantPagination(response.pagination);
      setSelectedTenantId((current) => {
        if (current && response.data.some((tenant) => tenant.id === current)) return current;
        return response.data.find((tenant) => tenant.lifecycleStatus === 'active')?.id ?? null;
      });
    } catch (error) {
      setTenantsError(getErrorMessage(error, 'تعذر تحميل قائمة المستأجرين.'));
    } finally {
      setTenantsLoading(false);
    }
  }, [tenantPage, tenantSearch]);

  useEffect(() => {
    loadTenants();
  }, [loadTenants]);

  const loadTenantData = useCallback(async () => {
    if (!selectedTenantId) {
      setMemberships([]);
      setRoles([]);
      setNodes([]);
      setPagination(null);
      return;
    }

    setMembershipsLoading(true);
    setMembershipsError('');
    try {
      const [membershipResponse, tenantRoles, organizationNodes] = await Promise.all([
        fetchPlatformTenantMemberships(selectedTenantId, {
          page,
          limit: PAGE_LIMIT,
          search: search.trim() || undefined,
        }),
        fetchPlatformTenantRoles(selectedTenantId),
        fetchPlatformTenantOrganizationNodes(selectedTenantId),
      ]);
      setMemberships(membershipResponse.data);
      setPagination(membershipResponse.pagination);
      setRoles(tenantRoles);
      setNodes(organizationNodes);
    } catch (error) {
      setMembershipsError(getErrorMessage(error, 'تعذر تحميل عضويات المستأجر وأدواره.'));
    } finally {
      setMembershipsLoading(false);
    }
  }, [page, search, selectedTenantId]);

  useEffect(() => {
    loadTenantData();
  }, [loadTenantData]);

  const selectedTenant = useMemo(
    () => tenants.find((tenant) => tenant.id === selectedTenantId) ?? null,
    [selectedTenantId, tenants]
  );

  const loadUsers = useCallback(async () => {
    setUsersLoading(true);
    setUsersError('');
    try {
      const response = await fetchMembershipUserOptions({
        page: userPage,
        limit: PAGE_LIMIT,
        search: userSearch.trim() || undefined,
      });
      setUsers(response.data);
      setUserPagination(response.pagination);
    } catch (error) {
      setUsersError(getErrorMessage(error, 'تعذر تحميل المستخدمين لإضافة العضوية.'));
    } finally {
      setUsersLoading(false);
    }
  }, [userPage, userSearch]);

  useEffect(() => {
    if (membershipDialogOpen) loadUsers();
  }, [loadUsers, membershipDialogOpen]);

  const availableUsers = useMemo(() => {
    const activeMembershipUserIds = new Set(
      memberships.filter((membership) => membership.isActive).map((membership) => membership.userId)
    );
    return users.filter((user) => !activeMembershipUserIds.has(user.id));
  }, [memberships, users]);

  const openMembershipDialog = () => {
    setMembershipFormError('');
    setUsersError('');
    setSelectedUserId('');
    setUserPage(1);
    setUserSearchInput('');
    setUserSearch('');
    setMembershipDialogOpen(true);
  };

  const submitMembership = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedTenantId || !selectedUserId) {
      setMembershipFormError('اختر مستخدماً لإضافة العضوية أو إعادة تفعيلها.');
      return;
    }
    setMembershipSaving(true);
    setMembershipFormError('');
    try {
      await addPlatformTenantMembership(selectedTenantId, Number(selectedUserId));
      setMembershipDialogOpen(false);
      await loadTenantData();
    } catch (error) {
      setMembershipFormError(getErrorMessage(error, 'تعذر إضافة العضوية أو إعادة تفعيلها.'));
    } finally {
      setMembershipSaving(false);
    }
  };

  const confirmMembershipAction = async () => {
    if (!selectedTenantId || !pendingAction) return;
    setActionBusy(true);
    setActionError('');
    try {
      if (pendingAction.type === 'reactivate') {
        await addPlatformTenantMembership(selectedTenantId, pendingAction.membership.userId);
      } else if (pendingAction.type === 'deactivate') {
        await deactivatePlatformTenantMembership(selectedTenantId, pendingAction.membership.userId);
      } else {
        await setPlatformTenantPrimaryMembership(selectedTenantId, pendingAction.membership.userId);
      }
      setPendingAction(null);
      await loadTenantData();
    } catch (error) {
      setActionError(getErrorMessage(error, 'تعذر تنفيذ عملية العضوية.'));
    } finally {
      setActionBusy(false);
    }
  };

  const openRoleDialog = (membership: PlatformTenantMembership, assignment?: PlatformTenantMembership['tenantRoles'][number]) => {
    setRoleDialog({ membership, assignmentId: assignment?.id ?? null });
    setRoleId(assignment ? String(assignment.roleId) : '');
    setNodeId(assignment?.organizationNodeId ? String(assignment.organizationNodeId) : '');
    setRoleFormError('');
  };

  const submitRole = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedTenantId || !roleDialog || !roleId) {
      setRoleFormError('اختر دوراً tenant-scoped قبل الحفظ.');
      return;
    }
    setRoleSaving(true);
    setRoleFormError('');
    const input = {
      roleId: Number(roleId),
      organizationNodeId: nodeId ? Number(nodeId) : null,
    };
    try {
      if (roleDialog.assignmentId) {
        await changePlatformTenantRole(selectedTenantId, roleDialog.membership.userId, roleDialog.assignmentId, input);
      } else {
        await assignPlatformTenantRole(selectedTenantId, roleDialog.membership.userId, input);
      }
      setRoleDialog(null);
      await loadTenantData();
    } catch (error) {
      setRoleFormError(getErrorMessage(error, 'تعذر إسناد الدور أو تغييره.'));
    } finally {
      setRoleSaving(false);
    }
  };

  const columns = useMemo<DataTableColumn<PlatformTenantMembership>[]>(() => [
    {
      key: 'user',
      header: 'المستخدم',
      render: (membership) => <><strong>{membership.user.fullName}</strong><br /><span dir="ltr">{membership.user.email}</span></>,
    },
    {
      key: 'accountStatus',
      header: 'الحساب',
      render: (membership) => <StatusBadge tone={membership.user.isActive ? 'success' : 'neutral'}>{membership.user.isActive ? 'نشط' : 'معطّل'}</StatusBadge>,
    },
    {
      key: 'membershipStatus',
      header: 'العضوية',
      render: (membership) => <><StatusBadge tone={membership.isActive ? 'success' : 'neutral'}>{membership.isActive ? 'نشطة' : 'معطّلة'}</StatusBadge>{membership.isPrimary && <span className="status-badge status-badge--info">أساسية</span>}</>,
    },
    {
      key: 'roles',
      header: 'الأدوار والوحدات',
      render: (membership) => membership.tenantRoles.length === 0 ? (
        <span className="muted">لا يوجد دور</span>
      ) : (
        <div className="admin-actions">
          {membership.tenantRoles.map((assignment) => (
            <button key={assignment.id} className="btn btn-outline" type="button" disabled={!membership.isActive} onClick={() => openRoleDialog(membership, assignment)}>
              {roleName(assignment.role)}{assignment.organizationNode ? ` — ${assignment.organizationNode.shortName || assignment.organizationNode.legalName}` : ''}
            </button>
          ))}
        </div>
      ),
    },
  ], []);

  const renderActions = (membership: PlatformTenantMembership) => (
    <div className="admin-actions">
      {membership.isActive ? (
        <>
          <button className="btn btn-outline" type="button" onClick={() => openRoleDialog(membership)}>إسناد دور</button>
          {!membership.isPrimary && <button className="btn btn-outline" type="button" onClick={() => { setActionError(''); setPendingAction({ type: 'primary', membership }); }}>تعيين كأساسية</button>}
          <button className="btn admin-btn-danger" type="button" onClick={() => { setActionError(''); setPendingAction({ type: 'deactivate', membership }); }}>تعطيل</button>
        </>
      ) : (
        <button className="btn btn-outline" type="button" onClick={() => { setActionError(''); setPendingAction({ type: 'reactivate', membership }); }}>إعادة تفعيل</button>
      )}
    </div>
  );

  const hasSelectedActiveTenant = selectedTenant?.lifecycleStatus === 'active';

  return (
    <div>
      <PageHeader
        title="عضويات وأدوار المستأجرين"
        description="إدارة عضويات المستخدمين وأدوارهم ووحداتهم التنظيمية على مستوى المنصة، دون الدخول في بيانات التشغيل."
        actions={<button className="btn btn-primary" type="button" disabled={!hasSelectedActiveTenant} onClick={openMembershipDialog}>إضافة أو إعادة تفعيل عضوية</button>}
      />

      <DataState loading={tenantsLoading} error={tenantsError} empty={!tenantsLoading && !tenantsError && tenants.length === 0} onRetry={loadTenants}>
        <div className="card" style={{ marginBottom: '16px' }}>
          <FilterBar onReset={tenantSearchInput || tenantSearch ? () => { setTenantSearchInput(''); setTenantSearch(''); setTenantPage(1); } : undefined}>
            <SearchInput label="بحث عن مستأجر" value={tenantSearchInput} onChange={setTenantSearchInput} onSubmit={() => { setTenantPage(1); setTenantSearch(tenantSearchInput); }} placeholder="الاسم القانوني أو الاسم المختصر أو المعرّف…" />
          </FilterBar>
          <div className="admin-form-grid">
            <Select label="المستأجر" value={selectedTenantId ? String(selectedTenantId) : ''} onChange={(event) => { setSelectedTenantId(event.target.value ? Number(event.target.value) : null); setPage(1); setSearch(''); setSearchInput(''); }}>
              <option value="">اختر مستأجراً نشطاً</option>
              {tenants.map((tenant) => (
                <option key={tenant.id} value={tenant.id} disabled={tenant.lifecycleStatus !== 'active'}>
                  {tenant.legalName} — {tenant.lifecycleStatus}
                </option>
              ))}
            </Select>
          </div>
          {tenantPagination && <Pagination page={tenantPagination.page} totalPages={tenantPagination.totalPages} total={tenantPagination.total} onPageChange={setTenantPage} />}
          {selectedTenant && !hasSelectedActiveTenant && <p className="ds-hint">عمليات العضوية والأدوار متاحة فقط للمستأجر النشط.</p>}
        </div>
      </DataState>

      {selectedTenantId && hasSelectedActiveTenant && (
        <>
          <FilterBar onReset={searchInput || search ? () => { setSearchInput(''); setSearch(''); setPage(1); } : undefined}>
            <SearchInput label="بحث في العضويات" value={searchInput} onChange={setSearchInput} onSubmit={() => { setPage(1); setSearch(searchInput); }} placeholder="الاسم أو البريد الإلكتروني…" />
          </FilterBar>
          <DataTable
            columns={columns}
            data={memberships}
            rowKey={(membership) => membership.id}
            loading={membershipsLoading}
            error={membershipsError}
            onRetry={loadTenantData}
            pagination={pagination && pagination.totalPages > 1 ? { page: pagination.page, totalPages: pagination.totalPages, onPageChange: setPage } : null}
            rowActions={renderActions}
            actionsHeader="إجراءات"
          />
        </>
      )}

      {actionError && <div className="alert alert-danger" role="alert" style={{ marginTop: '16px' }}>{actionError}</div>}

      {membershipDialogOpen && (
        <FormDialog title="إضافة أو إعادة تفعيل عضوية" onClose={() => setMembershipDialogOpen(false)} onSubmit={submitMembership} saving={membershipSaving} error={membershipFormError} submitLabel="حفظ العضوية">
          <div className="admin-form-grid">
            <Input
              label="بحث عن مستخدم"
              value={userSearchInput}
              onChange={(event) => setUserSearchInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  setUserPage(1);
                  setUserSearch(userSearchInput);
                }
              }}
              placeholder="الاسم أو البريد الإلكتروني…"
            />
            <button className="btn btn-outline" type="button" onClick={() => { setUserPage(1); setUserSearch(userSearchInput); }}>بحث</button>
          </div>
          {usersLoading ? <p>جارٍ تحميل خيارات المستخدمين…</p> : usersError ? <div className="alert alert-danger" role="alert">{usersError}</div> : (
            <>
              <Select label="المستخدم" value={selectedUserId} onChange={(event) => setSelectedUserId(event.target.value)} required>
                <option value="">اختر مستخدماً</option>
                {availableUsers.map((user) => {
                  const existing = memberships.find((membership) => membership.userId === user.id);
                  return <option key={user.id} value={user.id}>{user.fullName} — {user.email}{existing && !existing.isActive ? ' (ستتم إعادة التفعيل)' : ''}</option>;
                })}
              </Select>
              {userPagination && <Pagination page={userPagination.page} totalPages={userPagination.totalPages} total={userPagination.total} onPageChange={setUserPage} />}
            </>
          )}
          {!usersLoading && !usersError && availableUsers.length === 0 && <p className="ds-hint">لا يوجد مستخدم متاح للإضافة أو إعادة التفعيل في القائمة الحالية.</p>}
        </FormDialog>
      )}

      {roleDialog && (
        <FormDialog title={roleDialog.assignmentId ? 'تغيير الدور tenant-scoped' : 'إسناد دور tenant-scoped'} onClose={() => setRoleDialog(null)} onSubmit={submitRole} saving={roleSaving} error={roleFormError} submitLabel="حفظ الدور">
          <div className="admin-form-grid">
            <Select label="الدور" value={roleId} onChange={(event) => setRoleId(event.target.value)} required>
              <option value="">اختر دوراً</option>
              {roles.map((role) => <option key={role.id} value={role.id}>{role.nameAr || role.nameEn || role.code}</option>)}
            </Select>
            <Select label="الوحدة التنظيمية (اختياري)" value={nodeId} onChange={(event) => setNodeId(event.target.value)}>
              <option value="">على مستوى المستأجر</option>
              {nodes.map((node) => <option key={node.id} value={node.id}>{nodeName(node)}</option>)}
            </Select>
          </div>
        </FormDialog>
      )}

      {pendingAction && (
        <ConfirmDialog
          title={pendingAction.type === 'primary' ? 'تعيين العضوية الأساسية' : pendingAction.type === 'deactivate' ? 'تعطيل العضوية' : 'إعادة تفعيل العضوية'}
          message={pendingAction.type === 'primary' ? `هل تريد تعيين عضوية ${pendingAction.membership.user.fullName} كعضوية أساسية؟` : pendingAction.type === 'deactivate' ? `هل تريد تعطيل عضوية ${pendingAction.membership.user.fullName}؟ قد تمنع قواعد آخر مدير تنفيذ العملية.` : `هل تريد إعادة تفعيل عضوية ${pendingAction.membership.user.fullName}؟`}
          onClose={() => setPendingAction(null)}
          onConfirm={confirmMembershipAction}
          busy={actionBusy}
        />
      )}
    </div>
  );
}
