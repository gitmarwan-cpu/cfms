export default function SuccessPage({ referenceCode, trackingPin, onReset }) {
  return (
    <div className="card">
      <div className="card__body">
        <div className="ticket">
          <div className="ticket__seal">✓</div>
          <h2 className="ticket__title">تم تسجيل طلبك</h2>
          <p className="ticket__lede">هذا إيصالك الوحيد لمتابعة الطلب — احفظ الرقمين التاليين قبل مغادرة الصفحة</p>

          <div className="ticket__perforation" aria-hidden="true" />

          <div className="ticket__row">
            <span className="ticket__label">الرقم المرجعي</span>
            <span className="ticket__value">{referenceCode}</span>
          </div>

          {trackingPin && (
            <div className="ticket__row ticket__row--pin">
              <span className="ticket__label">رمز المتابعة (PIN)</span>
              <span className="ticket__value ticket__value--pin">{trackingPin}</span>
            </div>
          )}

          {trackingPin && (
            <p className="ticket__warning">
              يظهر رمز المتابعة الآن لمرة واحدة فقط ولا يمكن استرجاعه لاحقاً بأي وسيلة.
            </p>
          )}
        </div>

        <div className="ticket__actions">
          <button className="btn btn-primary" onClick={onReset}>
            تقديم طلب آخر
          </button>
        </div>
      </div>
    </div>
  );
}
