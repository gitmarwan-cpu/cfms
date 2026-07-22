import { createContext, useContext, useEffect, useState } from 'react';
import { fetchOrganizationSettings } from '../api/organizationApi';

const OrganizationContext = createContext(null);

/**
 * يطبّق الهوية البصرية (الألوان) على متغيرات CSS الجذرية (:root) ديناميكياً،
 * بحيث تُقرأ الألوان من قاعدة البيانات (إعدادات المؤسسة) بدلاً من كونها ثابتة
 * في index.css. القيم الافتراضية الحالية في index.css تبقى كـ fallback
 * (تظهر أثناء التحميل الأول أو إذا تعذر الوصول للخادم) لضمان عدم كسر الواجهة.
 */
const applyBrandingCssVars = (organization) => {
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
    const link = document.querySelector("link[rel='icon']") || document.createElement('link');
    link.rel = 'icon';
    link.href = organization.faviconUrl;
    document.head.appendChild(link);
  }
  if (organization.shortName || organization.legalName) {
    document.title = organization.shortName || organization.legalName;
  }
};

export function OrganizationProvider({ children }) {
  const [organization, setOrganization] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let isMounted = true;
    fetchOrganizationSettings()
      .then((data) => {
        if (!isMounted) return;
        setOrganization(data);
        applyBrandingCssVars(data);
      })
      .catch(() => {
        // فشل الجلب لا يجب أن يكسر نموذج تقديم الشكوى؛ تبقى الألوان الافتراضية
        // من index.css سارية كـ fallback آمن.
        if (isMounted) setError('تعذر تحميل إعدادات المؤسسة، تم استخدام الإعدادات الافتراضية');
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <OrganizationContext.Provider value={{ organization, loading, error }}>
      {children}
    </OrganizationContext.Provider>
  );
}

export const useOrganization = () => useContext(OrganizationContext);
