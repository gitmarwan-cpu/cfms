import { useState } from 'react';
import ComplaintForm from '../components/ComplaintForm';
import SuccessPage from './SuccessPage';
import type { SubmittedComplaint } from '../api/complaintApi';

export default function ComplaintPage() {
  const [result, setResult] = useState<SubmittedComplaint | null>(null);

  if (result) {
    return <SuccessPage referenceCode={result.referenceCode} trackingPin={result.trackingPin} onReset={() => setResult(null)} />;
  }

  return (
    <div className="card">
      <div className="card__header">
        <h2>تقديم شكوى / مقترح</h2>
        <p>نموذج QR-ME-02-01 — الرجاء تعبئة جميع الحقول المطلوبة بدقة</p>
      </div>
      <div className="card__body">
        <ComplaintForm onSuccess={setResult} />
      </div>
    </div>
  );
}
