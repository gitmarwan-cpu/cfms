import { useEffect, useState } from 'react';
import { fetchGroups, type Group } from '../../api/adminApi';
import type { ApiClientError } from '../../api/axiosClient';
import { DataState, PageHeader } from '../../components/admin/AdminUi';

export default function GroupsPage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = () => {
    setLoading(true);
    setError('');
    fetchGroups()
      .then(setGroups)
      .catch((err: ApiClientError) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  return (
    <>
      <PageHeader title="المجموعات والفرق" description="بيانات Groups محفوظة للقراءة والتدقيق فقط أثناء الانتقال إلى التعيين المباشر للأدوار." />
      <div className="admin-readonly-note" role="status">
        المجموعات مجمّدة: لا يمكن إنشاء مجموعات أو تعديلها أو حذفها أو ربطها بالأدوار. تبقى البيانات الحالية قابلة للاستعراض لأغراض الترحيل والتدقيق.
      </div>
      <DataState loading={loading} error={error} empty={!groups.length} onRetry={load}>
        <div className="card admin-table-card"><div className="admin-table-wrap"><table className="admin-table">
          <thead><tr><th>الاسم</th><th>الرمز</th><th>الوصف</th><th>الحالة</th></tr></thead>
          <tbody>{groups.map((group) => <tr key={group.id}><td>{group.nameAr}</td><td dir="ltr">{group.code}</td><td>{group.description || '—'}</td><td><span className={`admin-status-pill ${group.isActive ? 'is-success' : ''}`}>{group.isActive ? 'نشطة' : 'معطلة'}</span></td></tr>)}</tbody>
        </table></div></div>
      </DataState>
    </>
  );
}
