import { Check } from 'lucide-react';
import { Link } from 'react-router-dom';

interface SuccessPageProps {
  referenceCode: string;
  trackingPin: string;
  onReset: () => void;
  /** Optional portal "track complaint" action (only on the public portal route). */
  trackHref?: string;
}

/**
 * Complaint submission confirmation ("receipt"). Renders on the existing
 * ticket design-system classes (index.css .ticket*) — centered card layout,
 * clear success indicator, mono reference/PIN rows (LTR digits), one-time PIN
 * warning, and centered actions. Fully responsive via the .ticket* media rules.
 */
export default function SuccessPage({ referenceCode, trackingPin, onReset, trackHref }: SuccessPageProps) {
  return (
    <div className="card" style={{ maxWidth: '600px', margin: '0 auto' }}>
      <div className="card__body">
        <div className="ticket" role="status" aria-live="polite">
          {/* Success seal */}
          <div className="ticket__seal ticket__seal--success">
            <Check size={26} strokeWidth={3} aria-hidden="true" />
          </div>

          <h2 className="ticket__title">تم تسجيل طلبك بنجاح</h2>
          <p className="ticket__lede">
            هذا إيصالك الوحيد — احفظ الرقمين أدناه قبل مغادرة الصفحة.
          </p>

          <div className="ticket__perforation" aria-hidden="true" />

          {/* Reference number */}
          <div className="ticket__row">
            <span className="ticket__label">الرقم المرجعي</span>
            <span className="ticket__value" dir="ltr">{referenceCode}</span>
          </div>

          {/* Tracking PIN */}
          {trackingPin && (
            <div className="ticket__row ticket__row--pin">
              <span className="ticket__label">رمز المتابعة (PIN)</span>
              <span className="ticket__value ticket__value--pin" dir="ltr">{trackingPin}</span>
            </div>
          )}

          {trackingPin && (
            <p className="ticket__warning">
              ⚠ يظهر رمز المتابعة الآن لمرة واحدة فقط ولا يمكن استرجاعه لاحقاً.
            </p>
          )}

          <div className="ticket__actions">
            <button className="btn btn-primary" onClick={onReset} type="button">
              تقديم طلب آخر
            </button>
            {trackHref && (
              <Link className="btn btn-outline" to={trackHref}>
                متابعة الطلب
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
