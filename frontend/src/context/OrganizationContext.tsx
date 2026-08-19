import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import { fetchOrganizationSettings, type PublicOrganizationSettings } from '../api/organizationApi';

interface OrganizationContextValue {
  organization: PublicOrganizationSettings | null;
  orgSlug: string | undefined;
  loading: boolean;
  error: string;
}

const OrganizationContext = createContext<OrganizationContextValue | null>(null);

/**
 * يطبّق الهوية البصرية (الألوان) على متغيرات CSS الجذرية (:root) ديناميكياً،
 * بحيث تُقرأ الألوان من قاعدة البيانات (إعدادات المؤسسة) بدلاً من كونها ثابتة
 * في index.css. القيم الافتراضية الحالية في index.css تبقى كـ fallback
 * (تظهر أثناء التحميل الأول أو إذا تعذر الوصول للخادم) لضمان عدم كسر الواجهة.
 */
const applyBrandingCssVars = (organization: PublicOrganizationSettings | null) => {
  if (!organization) return;
  const root = document.documentElement;
  if (organization.primaryColor) root.style.setProperty('--color-primary', organization.primaryColor);
  if (organization.secondaryColor) root.style.setProperty('--color-primary-dark', organization.secondaryColor);
  if (organization.accentColor) root.style.setProperty('--color-accent', organization.accentColor);
  if (organization.defaultLanguage) {
    document.documentElement.lang = organization.defaultLanguage;
    document.documentElement.dir = organization.defaultLanguage === 'en' ? 'ltr' : 'rtl';
  }
  if (organization.faviconUrl) {
    const link = document.querySelector<HTMLLinkElement>("link[rel='icon']") || document.createElement('link');
    link.rel = 'icon';
    link.href = organization.faviconUrl;
    document.head.appendChild(link);
  }
  if (organization.shortName || organization.legalName) {
    document.title = organization.shortName || organization.legalName;
  }
};

/**
 * مصدر الحقيقة الوحيد لتحديد orgSlug داخل الواجهة: جزء من مسار الرابط
 * (Route param)، مثال /:orgSlug و/:orgSlug/track. لا يوجد أي orgSlug
 * افتراضي مكتوب في الكود - إن لم يكن موجوداً في الرابط، لا تُحمَّل أي
 * بيانات مؤسسة، ويظهر ذلك بوضوح في الحالة (organization = null, error).
 */
export function OrganizationProvider({ children }: { children: ReactNode }) {
  const { orgSlug } = useParams<{ orgSlug: string }>();
  const [organization, setOrganization] = useState<PublicOrganizationSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!orgSlug) {
      setLoading(false);
      setError('لم يتم تحديد رابط مؤسسة صالح');
      return undefined;
    }

    let isMounted = true;
    setLoading(true);
    setError('');

    fetchOrganizationSettings(orgSlug)
      .then((data) => {
        if (!isMounted) return;
        setOrganization(data);
        applyBrandingCssVars(data);
      })
      .catch(() => {
        // فشل الجلب لا يجب أن يكسر نموذج تقديم الشكوى بالكامل؛ تبقى الألوان
        // الافتراضية من index.css سارية كـ fallback آمن، لكن لا بيانات مرجعية
        // توهمية - المكوّنات المستهلكة يجب أن تتعامل مع organization = null.
        if (isMounted) setError('تعذر تحميل إعدادات المؤسسة - تحقق من صحة رابط المؤسسة (orgSlug)');
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [orgSlug]);

  return (
    <OrganizationContext.Provider value={{ organization, orgSlug, loading, error }}>
      {children}
    </OrganizationContext.Provider>
  );
}

export const useOrganization = () => useContext(OrganizationContext);
