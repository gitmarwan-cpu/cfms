export default function SuccessPage({ referenceCode, trackingPin, onReset }) {
  return (
    <div className="card">
      <div className="card__body success-screen">
        <div className="success-screen__icon">✓</div>
        <h2>تم استلام طلبك بنجاح</h2>
        <p>يرجى الاحتفاظ بالرقم المرجعي ورمز المتابعة التاليين لمتابعة حالة طلبك لاحقاً:</p>
        <div className="success-screen__code">{referenceCode}</div>
        {trackingPin && (
          <>
            <p className="alert alert-danger">
              رمز المتابعة (PIN): <strong>{trackingPin}</strong>
              <br />
              هذا الرمز يظهر مرة واحدة فقط الآن ولا يمكن استرجاعه لاحقاً - احفظه في مكان آمن.
            </p>
          </>
        )}
        <div>
          <button className="btn btn-primary" onClick={onReset}>
            تقديم طلب آخر
          </button>
        </div>
      </div>
    </div>
  );
}
