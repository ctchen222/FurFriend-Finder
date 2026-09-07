import express from 'express';
import { router as animalRoute } from './animalRouter';
import { router as viewRoute } from './viewRouter';
import { router as animalLostRoute } from './animalLostRouter';
import { router as authRoute } from './authRouter';
import { router as webhookRoute } from './webhookRouter';
import { router as healthRoute } from './healthRouter';
import { addUserToLocals } from '../middleware/userSession';
import { createWebApiRouter, createWebConfigRouter } from './webApiRouter';
import { createReactWebRouter } from './reactWebRouter';
import {
    createOrganizationAnimalRouter,
    createPublicOrganizationAnimalRouter,
} from './organizationAnimalRouter';
import {
    createOrganizationActionRouter,
    createOrganizationRouter,
} from './organizationRouter';
import {
    createOrganizationReviewRouter,
    createPublicOrganizationRouter,
} from './organizationReviewRouter';

export default function routes(app: express.Express) {
    app.use('/health', healthRoute);
    // These endpoints are intentionally public and must be mounted before the
    // broad authenticated action router at /api/v1.
    app.use('/api/v1/config', createWebConfigRouter());
    app.use(
        '/api/v1/public/organizations/:orgId/animals',
        createPublicOrganizationAnimalRouter(),
    );
    app.use('/api/v1/public/organizations', createPublicOrganizationRouter());
    app.use('/api/v1', createOrganizationActionRouter());
    app.use('/api/v1/reviewer/organizations', createOrganizationReviewRouter());
    app.use(
        '/api/v1/organizations/:orgId/animals',
        createOrganizationAnimalRouter(),
    );
    app.use('/api/v1/organizations', createOrganizationRouter());
    app.use('/api/v1', createWebApiRouter());

    app.use('/api/animals', animalRoute);
    app.use('/api/lost-animals', addUserToLocals, animalLostRoute);
    app.use('/api/auth', addUserToLocals, authRoute);

    app.use('/webhook', webhookRoute);

    // Explicit temporary rollback path while React is under user acceptance.
    if (process.env.LEGACY_WEB_ENABLED === 'true') {
        app.use('/', addUserToLocals, viewRoute);
    } else {
        app.use('/', createReactWebRouter());
    }
}
