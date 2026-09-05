import { useState } from 'react';
import { useParams } from 'react-router-dom';
import ComplaintForm from '../components/ComplaintForm';
import SuccessPage from './SuccessPage';
import type { SubmittedComplaint } from '../api/complaintApi';

export default function ComplaintPage() {
  const { orgSlug } = useParams();
  const [result, setResult] = useState<SubmittedComplaint | null>(null);

  if (result) {
    return (
      <SuccessPage
        referenceCode={result.referenceCode}
        trackingPin={result.trackingPin}
        onReset={() => setResult(null)}
        trackHref={orgSlug ? `/${orgSlug}/track` : undefined}
      />
    );
  }

  return (
    <div style={{ width: '100%', maxWidth: '860px' }}>
      <div className="card">
        <div className="card__header">
          <h2>تقديم شكوى / مقترح</h2>
          <p>نموذج QR-ME-02-01 — الرجاء تعبئة جميع الحقول المطلوبة بدقة</p>
        </div>
        <div className="card__body">
          <ComplaintForm onSuccess={setResult} />
        </div>
      </div>
    </div>
  );
}
