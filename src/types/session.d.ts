import { SessionData } from 'express-session';

export interface ISessionWithUser extends SessionData {
    user?: {
        id: number;
        name: string | null;
        email: string | null;
    };
}