import type { LostReport, ReportInput, ReportStatus } from '../../../../src/contracts/web';
import { patch, post } from '../../api/client';

export const reportsApi = {
  create: (input: ReportInput) => post<{ report: LostReport }>('/api/v1/reports', input),
  edit: (id: number, expectedRevision: number, report: ReportInput) => patch<{ report: LostReport }>(`/api/v1/reports/${id}`, { expectedRevision, report }),
  close: (id: number, expectedRevision: number, status: Exclude<ReportStatus, 'OPEN'>) => post(`/api/v1/reports/${id}/close`, { expectedRevision, status }),
  match: (id: number) => post(`/api/v1/reports/${id}/match`),
};
export const reportStatusLabel = (status: ReportStatus) => ({ OPEN: '協尋中', REUNITED: '已找回', CLOSED: '已結案' })[status];
