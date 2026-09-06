/** Public JSON contracts. This module must not import server dependencies. */
export interface SessionUser {
    id: string;
    name: string;
    email: string;
    emailVerified: boolean;
    isLostAnimalMailEnabled: boolean;
}

export type ReportStatus = 'OPEN' | 'REUNITED' | 'CLOSED';
export interface LostReport {
    id: number;
    name: string | null;
    kind: string;
    variety: string | null;
    sex: string | null;
    colour: string | null;
    lost_time: string | null;
    lost_place: string;
    outlook: string | null;
    feature: string | null;
    status: ReportStatus;
    revision: number;
}
export interface ReportInput {
    name: string;
    kind: string;
    variety: string;
    sex: string;
    colour: string;
    lost_time: string;
    lost_place: string;
    outlook: string;
    feature: string;
}
export interface PetCardData {
    id: number;
    sub_id?: string | null;
    kind?: string | null;
    variety?: string | null;
    sex?: string | null;
    colour?: string | null;
    picture?: string | null;
    remark?: string | null;
    found_place?: string | null;
    shelter_name?: string | null;
    shelter_address?: string | null;
    shelter_tel?: string | null;
    distance?: number | null;
    score?: number | null;
    reasons?: string[];
}
export interface ReportDetail {
    report: LostReport;
    job: { state: string; attempts: number; last_error_code: string | null } | null;
    match: { run: { status?: string }; candidates: PetCardData[] } | null;
    notification: { state: string; attempts: number; last_error_code: string | null } | null;
}
