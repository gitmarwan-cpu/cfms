import axiosClient from './axiosClient';

export interface ComplaintFormValues {
  [key: string]: string | boolean | undefined;
  type?: string;
  isAnonymous?: boolean;
  fullName?: string;
  gender?: string;
  ageGroup?: string;
  relationship?: string;
  phone?: string;
  email?: string;
  governorateId?: string;
  districtId?: string;
  village?: string;
  category?: string;
  isSensitive?: boolean;
  description?: string;
  desiredResolution?: string;
  projectReferenceCode?: string;
  isRelatedToStaff?: boolean;
  relatedStaffName?: string;
  relatedStaffPosition?: string;
  staffIncidentDetails?: string;
  channel?: string;
  consentGiven?: boolean;
}

export interface SubmittedComplaint {
  id: number;
  referenceCode: string;
  trackingPin: string;
}

export interface TrackedComplaint {
  referenceCode: string;
  status: string;
  statusLabel: string;
  submittedAt: string;
  lastUpdatedAt: string;
}

export const submitComplaint = async (
  orgSlug: string | undefined,
  formValues: ComplaintFormValues,
  files: File[]
): Promise<SubmittedComplaint> => {
  if (!orgSlug) {
    throw new Error('orgSlug مطلوب لتقديم الشكوى');
  }

  const formData = new FormData();

  Object.entries(formValues).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    formData.append(key, String(value));
  });

  files.forEach((file) => {
    formData.append('attachments', file);
  });

  const res = await axiosClient.post<{ data: SubmittedComplaint }>(`/public/${orgSlug}/complaints`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data.data;
};

export const trackComplaint = async (
  orgSlug: string | undefined,
  referenceCode: string,
  pin: string
): Promise<TrackedComplaint> => {
  if (!orgSlug) {
    throw new Error('orgSlug مطلوب لمتابعة الشكوى');
  }
  const res = await axiosClient.post<{ data: TrackedComplaint }>(`/public/${orgSlug}/complaints/track`, { referenceCode, pin });
  return res.data.data;
};
