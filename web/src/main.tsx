import React from 'react';
import { createRoot } from 'react-dom/client';
import {
    createBrowserRouter,
    createRoutesFromElements,
    RouterProvider,
    Outlet,
    Route,
    Link,
} from 'react-router-dom';
import { SessionProvider, Protected } from './features/auth/SessionProvider';
import { AuthPage } from './features/auth/AuthPage';
import { HomePage } from './pages/HomePage';
import { Layout } from './ui/Layout';
import { ProfilePage } from './pages/ProfilePage';
import { CreateReportPage } from './pages/CreateReportPage';
import { ReportDetailPage } from './pages/ReportDetailPage';
import { QuickMatchPage } from './pages/QuickMatchPage';
import { AnimalsPage, AnimalDetailPage } from './pages/AnimalsPage';
import {
    OrganizationsPage,
    OrganizationWorkspacePage,
} from './features/organizations/OrganizationPages';
import { CreateOrganizationPage } from './features/organizations/CreateOrganizationPage';
import {
    OrganizationInvitationPage,
    OwnershipTransferPage,
} from './features/organizations/OrganizationActionPages';
import {
    PublicOrganizationDetailPage,
    PublicOrganizationsPage,
} from './features/organizations/PublicOrganizationPages';
import { ReviewerOrganizationsPage } from './features/organizations/ReviewerOrganizationsPage';
import './styles.css';
import {
    OrganizationAnimalsPage,
    OrganizationAnimalEditorPage,
    PublicOrganizationAnimalPage,
} from './features/organization-animals/AnimalListingPages';

const router = createBrowserRouter(
    createRoutesFromElements(
        <Route
            element={
                <SessionProvider>
                    <Outlet />
                </SessionProvider>
            }
        >
            <Route element={<Layout />}>
                <Route index element={<HomePage />} />
                <Route
                    path="login"
                    element={<AuthPage key="login" mode="login" />}
                />
                <Route
                    path="register"
                    element={<AuthPage key="register" mode="register" />}
                />
                <Route
                    path="forgot-password"
                    element={<AuthPage key="forgot" mode="forgot" />}
                />
                <Route
                    path="reset-password"
                    element={<AuthPage key="reset" mode="reset" />}
                />
                <Route
                    path="profile"
                    element={
                        <Protected>
                            <ProfilePage />
                        </Protected>
                    }
                />
                <Route
                    path="organizations"
                    element={
                        <Protected>
                            <OrganizationsPage />
                        </Protected>
                    }
                />
                <Route
                    path="organizations/new"
                    element={
                        <Protected>
                            <CreateOrganizationPage />
                        </Protected>
                    }
                />
                <Route
                    path="foster-organizations"
                    element={<PublicOrganizationsPage />}
                />
                <Route
                    path="foster-organizations/:id"
                    element={<PublicOrganizationDetailPage />}
                />
                <Route
                    path="review/organizations"
                    element={
                        <Protected>
                            <ReviewerOrganizationsPage />
                        </Protected>
                    }
                />
                <Route
                    path="orgs/:orgId/animals"
                    element={
                        <Protected>
                            <OrganizationAnimalsPage />
                        </Protected>
                    }
                />
                <Route
                    path="orgs/:orgId/animals/new"
                    element={
                        <Protected>
                            <OrganizationAnimalEditorPage />
                        </Protected>
                    }
                />
                <Route
                    path="orgs/:orgId/animals/:animalId"
                    element={
                        <Protected>
                            <OrganizationAnimalEditorPage />
                        </Protected>
                    }
                />
                <Route
                    path="foster-organizations/:orgId/animals/:animalId"
                    element={<PublicOrganizationAnimalPage />}
                />
                <Route
                    path="orgs/:id"
                    element={
                        <Protected>
                            <OrganizationWorkspacePage />
                        </Protected>
                    }
                />
                <Route
                    path="organization-invitations/:token"
                    element={
                        <Protected>
                            <OrganizationInvitationPage />
                        </Protected>
                    }
                />
                <Route
                    path="organization-ownership-transfers/:token"
                    element={
                        <Protected>
                            <OwnershipTransferPage />
                        </Protected>
                    }
                />
                <Route
                    path="report-lost"
                    element={
                        <Protected>
                            <CreateReportPage />
                        </Protected>
                    }
                />
                <Route
                    path="reports/:id"
                    element={
                        <Protected>
                            <ReportDetailPage />
                        </Protected>
                    }
                />
                <Route path="quick-use" element={<QuickMatchPage />} />
                <Route path="shelter-animals" element={<AnimalsPage />} />
                <Route
                    path="shelter-animals/:id"
                    element={<AnimalDetailPage />}
                />
                <Route
                    path="*"
                    element={
                        <section className="section">
                            <h1>找不到這個頁面</h1>
                            <Link to="/">返回首頁</Link>
                        </section>
                    }
                />
            </Route>
        </Route>,
    ),
);

createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <RouterProvider router={router} />
    </React.StrictMode>,
);
