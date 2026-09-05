import { useState } from 'react';
import { Button } from '../../ui/Button';
import { Dialog } from '../../ui/Dialog';
import { regenerateTrackingPin } from '../../../api/adminApi';
import { useToast } from './Toast';
import { RefreshCw } from 'lucide-react';

interface RegeneratePinActionProps {
  complaintId: number;
  onSuccess: () => void;
}

export function RegeneratePinAction({ complaintId, onSuccess }: RegeneratePinActionProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const { showToast } = useToast();

  const handleConfirm = async () => {
    try {
      setLoading(true);
      const res = await regenerateTrackingPin(complaintId);
      showToast('success', res.message || 'تم إعادة التوليد بنجاح');
      setOpen(false);
      onSuccess();
    } catch (err: any) {
      showToast('error', err.message || 'حدث خطأ أثناء إعادة توليد الرمز');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button 
        type="button" 
        onClick={() => setOpen(true)}
        className="btn btn-secondary btn-sm flex items-center justify-center"
        title="إعادة توليد وإرسال رمز المتابعة"
        aria-label="إعادة توليد الرمز"
      >
        <RefreshCw size={14} aria-hidden="true" />
      </button>

      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="إعادة توليد وإرسال رمز المتابعة"
      >
        <div className="p-4">
          <p className="mb-4 text-sm text-foreground">
            سيتم إبطال رمز المتابعة الحالي وإنشاء رمز جديد وإرساله إلى وسيلة الاتصال المسجلة لمقدم الشكوى.
          </p>
          <div className="flex justify-end gap-2 mt-6">
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={loading}>
              إلغاء
            </Button>
            <Button variant="primary" onClick={handleConfirm} disabled={loading} loading={loading}>
              إعادة التوليد والإرسال
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
