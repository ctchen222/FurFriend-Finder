export type OrganizationNotificationKind =
    | 'APPROVED'
    | 'REJECTED'
    | 'SUSPENDED'
    | 'REACTIVATED';
export interface OrganizationNotification {
    id: string;
    organizationId: string;
    organizationName: string;
    kind: OrganizationNotificationKind;
    reason: string;
    createdAt: string;
    readAt: string | null;
}
export interface OrganizationNotificationPage {
    notifications: OrganizationNotification[];
    unreadCount: number;
    nextCursor: string | null;
}
export interface NoticeDeliveryHealth {
    heartbeatAt: string | null;
    workerHealthy: boolean;
    pending: number;
    failed: number;
    oldestOverdueSeconds: number;
    failures: {
        id: string;
        organizationName: string;
        kind: OrganizationNotificationKind;
        attempts: number;
        errorCode: string;
        lastRetryAt: string | null;
    }[];
    nextCursor: string | null;
}
export const notificationLabels: Record<
    OrganizationNotificationKind,
    { title: string; nextStep: string }
> = {
    APPROVED: {
        title: '中途之家已通過審核',
        nextStep: '請前往組織確認最新狀態，並由負責人或管理員選擇是否公開。',
    },
    REJECTED: {
        title: '中途之家需要補充資料',
        nextStep: '請負責人或管理員依理由修改組織資料，儲存後會重新送審。',
    },
    SUSPENDED: {
        title: '中途之家已停權',
        nextStep:
            '組織及動物已停止對外顯示。請前往組織查看狀態；如需協助，請聯絡平台管理者。',
    },
    REACTIVATED: {
        title: '中途之家已恢復運作',
        nextStep: '組織不會自動重新公開，請負責人或管理員確認資料後再公開。',
    },
};
