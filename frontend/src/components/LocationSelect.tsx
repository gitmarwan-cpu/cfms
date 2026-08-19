import { useEffect, useState } from 'react';
import { fetchDistrictsByGovernorate, type DistrictSummary, type GovernorateSummary } from '../api/locationApi';

/**
 * مكوّن قابل لإعادة الاستخدام: قائمتان منسدلتان مرتبطتان
 * (محافظة -> مديرية). عند تغيير المحافظة يتم تحميل مديرياتها
 * تلقائياً وتُصفّر المديرية المختارة سابقاً.
 */
interface LocationSelectProps {
  governorates: GovernorateSummary[];
  governorateId: string;
  districtId: string;
  onGovernorateChange: (value: string) => void;
  onDistrictChange: (value: string) => void;
  errors?: Record<string, string | undefined>;
}

export default function LocationSelect({
  governorates,
  governorateId,
  districtId,
  onGovernorateChange,
  onDistrictChange,
  errors = {},
}: LocationSelectProps) {
  const [districts, setDistricts] = useState<DistrictSummary[]>([]);
  const [loadingDistricts, setLoadingDistricts] = useState(false);

  useEffect(() => {
    let isCancelled = false;

    if (!governorateId) {
      setDistricts([]);
      return undefined;
    }

    setLoadingDistricts(true);
    fetchDistrictsByGovernorate(governorateId)
      .then((data) => {
        if (!isCancelled) setDistricts(data);
      })
      .catch(() => {
        if (!isCancelled) setDistricts([]);
      })
      .finally(() => {
        if (!isCancelled) setLoadingDistricts(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [governorateId]);

  return (
    <>
      <div className="field">
        <label htmlFor="governorateId">
          المحافظة <span className="required">*</span>
        </label>
        <select
          id="governorateId"
          value={governorateId}
          onChange={(e) => {
            onGovernorateChange(e.target.value);
            onDistrictChange('');
          }}
        >
          <option value="">-- اختر المحافظة --</option>
          {governorates.map((g) => (
            <option key={g.id} value={g.id}>
              {g.nameAr}
            </option>
          ))}
        </select>
        {errors.governorateId && <span className="field-error">{errors.governorateId}</span>}
      </div>

      <div className="field">
        <label htmlFor="districtId">
          المديرية <span className="required">*</span>
        </label>
        <select
          id="districtId"
          value={districtId}
          disabled={!governorateId || loadingDistricts}
          onChange={(e) => onDistrictChange(e.target.value)}
        >
          <option value="">
            {loadingDistricts ? 'جاري تحميل المديريات...' : '-- اختر المديرية --'}
          </option>
          {districts.map((d) => (
            <option key={d.id} value={d.id}>
              {d.nameAr}
            </option>
          ))}
        </select>
        {errors.districtId && <span className="field-error">{errors.districtId}</span>}
      </div>
    </>
  );
}
