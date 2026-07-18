export default function SuccessPage({ referenceCode, onReset }) {
  return (
    <div className="card">
      <div className="card__body success-screen">
        <div className="success-screen__icon">✓</div>
        <h2>تم استلام طلبك بنجاح</h2>
        <p>يرجى الاحتفاظ بالرقم المرجعي التالي لمتابعة حالة طلبك لاحقاً:</p>
        <div className="success-screen__code">{referenceCode}</div>
        <div>
          <button className="btn btn-primary" onClick={onReset}>
            تقديم طلب آخر
          </button>
        </div>
      </div>
    </div>
  );
}
