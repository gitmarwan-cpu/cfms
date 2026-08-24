import { useEffect, useState } from 'react';
import {
  fetchCountries,
  fetchDistrictsByGovernorate,
  fetchGovernorates,
  type CountrySummary,
  type DistrictSummary,
  type GovernorateSummary,
} from '../api/locationApi';

interface LocationSelectProps {
  countryId?: string | number | null;
  governorateId?: string | number | null;
  districtId?: string | number | null;
  onCountryChange?: (value: string) => void;
  onGovernorateChange: (value: string) => void;
  onDistrictChange: (value: string) => void;
  governorates?: GovernorateSummary[];
  showCountry?: boolean;
  isRequired?: boolean;
  errors?: Record<string, string | undefined>;
}

export default function LocationSelect({
  countryId = '',
  governorateId = '',
  districtId = '',
  onCountryChange,
  onGovernorateChange,
  onDistrictChange,
  governorates: propGovernorates,
  showCountry = false,
  isRequired = true,
  errors = {},
}: LocationSelectProps) {
  const [countries, setCountries] = useState<CountrySummary[]>([]);
  const [loadingCountries, setLoadingCountries] = useState(false);
  const [countryError, setCountryError] = useState('');

  const [governorates, setGovernorates] = useState<GovernorateSummary[]>(propGovernorates || []);
  const [loadingGovernorates, setLoadingGovernorates] = useState(false);
  const [governorateError, setGovernorateError] = useState('');

  const [districts, setDistricts] = useState<DistrictSummary[]>([]);
  const [loadingDistricts, setLoadingDistricts] = useState(false);
  const [districtError, setDistrictError] = useState('');

  const currentCountryIdStr = countryId ? String(countryId) : '';
  const currentGovernorateIdStr = governorateId ? String(governorateId) : '';
  const currentDistrictIdStr = districtId ? String(districtId) : '';

  // 1. Fetch Countries if showCountry is true
  useEffect(() => {
    if (!showCountry) return undefined;

    let isCancelled = false;
    setLoadingCountries(true);
    setCountryError('');

    fetchCountries()
      .then((data) => {
        if (!isCancelled) setCountries(data);
      })
      .catch(() => {
        if (!isCancelled) {
          setCountries([]);
          setCountryError('تعذر تحميل قائمة الدول');
        }
      })
      .finally(() => {
        if (!isCancelled) setLoadingCountries(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [showCountry]);

  // 2. Fetch Governorates based on Country or props
  useEffect(() => {
    if (propGovernorates && !showCountry) {
      setGovernorates(propGovernorates);
      return undefined;
    }

    let isCancelled = false;

    if (showCountry && !currentCountryIdStr) {
      setGovernorates([]);
      setLoadingGovernorates(false);
      return undefined;
    }

    setLoadingGovernorates(true);
    setGovernorateError('');

    fetchGovernorates(showCountry ? currentCountryIdStr : undefined)
      .then((data) => {
        if (!isCancelled) setGovernorates(data);
      })
      .catch(() => {
        if (!isCancelled) {
          setGovernorates([]);
          setGovernorateError('تعذر تحميل المحافظات');
        }
      })
      .finally(() => {
        if (!isCancelled) setLoadingGovernorates(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [showCountry, currentCountryIdStr, propGovernorates]);

  // 3. Fetch Districts based on Governorate
  useEffect(() => {
    let isCancelled = false;

    if (!currentGovernorateIdStr) {
      setDistricts([]);
      setLoadingDistricts(false);
      return undefined;
    }

    setLoadingDistricts(true);
    setDistrictError('');

    fetchDistrictsByGovernorate(currentGovernorateIdStr)
      .then((data) => {
        if (!isCancelled) setDistricts(data);
      })
      .catch(() => {
        if (!isCancelled) {
          setDistricts([]);
          setDistrictError('تعذر تحميل المديريات');
        }
      })
      .finally(() => {
        if (!isCancelled) setLoadingDistricts(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [currentGovernorateIdStr]);

  const renderGovernoratePlaceholder = () => {
    if (showCountry && !currentCountryIdStr) return '-- اختر الدولة أولاً --';
    if (loadingGovernorates) return 'جاري تحميل المحافظات...';
    if (showCountry && currentCountryIdStr && governorates.length === 0) return 'لا توجد محافظات لهذه الدولة';
    return '-- اختر المحافظة --';
  };

  const renderDistrictPlaceholder = () => {
    if (!currentGovernorateIdStr) return '-- اختر المحافظة أولاً --';
    if (loadingDistricts) return 'جاري تحميل المديريات...';
    if (currentGovernorateIdStr && districts.length === 0) return 'لا توجد مديريات لهذه المحافظة';
    return '-- اختر المديرية --';
  };

  return (
    <>
      {showCountry && (
        <div className="field">
          <label htmlFor="countryId">
            الدولة {isRequired && <span className="required">*</span>}
          </label>
          <select
            id="countryId"
            value={currentCountryIdStr}
            disabled={loadingCountries}
            onChange={(e) => {
              const val = e.target.value;
              onCountryChange?.(val);
              onGovernorateChange('');
              onDistrictChange('');
            }}
          >
            <option value="">
              {loadingCountries ? 'جاري تحميل الدول...' : countries.length === 0 ? 'لا توجد دول متاحة' : '-- اختر الدولة --'}
            </option>
            {countries.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nameAr}
              </option>
            ))}
          </select>
          {(errors.countryId || countryError) && (
            <span className="field-error">{errors.countryId || countryError}</span>
          )}
        </div>
      )}

      <div className="field">
        <label htmlFor="governorateId">
          المحافظة {isRequired && <span className="required">*</span>}
        </label>
        <select
          id="governorateId"
          value={currentGovernorateIdStr}
          disabled={(showCountry && !currentCountryIdStr) || loadingGovernorates}
          onChange={(e) => {
            const val = e.target.value;
            onGovernorateChange(val);
            onDistrictChange('');
          }}
        >
          <option value="">{renderGovernoratePlaceholder()}</option>
          {governorates.map((g) => (
            <option key={g.id} value={g.id}>
              {g.nameAr}
            </option>
          ))}
        </select>
        {(errors.governorateId || governorateError) && (
          <span className="field-error">{errors.governorateId || governorateError}</span>
        )}
      </div>

      <div className="field">
        <label htmlFor="districtId">
          المديرية {isRequired && <span className="required">*</span>}
        </label>
        <select
          id="districtId"
          value={currentDistrictIdStr}
          disabled={!currentGovernorateIdStr || loadingDistricts}
          onChange={(e) => onDistrictChange(e.target.value)}
        >
          <option value="">{renderDistrictPlaceholder()}</option>
          {districts.map((d) => (
            <option key={d.id} value={d.id}>
              {d.nameAr}
            </option>
          ))}
        </select>
        {(errors.districtId || districtError) && (
          <span className="field-error">{errors.districtId || districtError}</span>
        )}
      </div>
    </>
  );
}
