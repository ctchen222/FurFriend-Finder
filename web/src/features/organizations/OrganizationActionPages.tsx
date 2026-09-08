import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type {
    OrganizationInvitationDetail,
    OrganizationOwnershipTransferDetail,
} from '../../../../src/contracts/organizations';
import { post } from '../../api/client';
import { useResource } from '../../hooks/useResource';
import { Feedback } from '../../ui/Feedback';
import { useSession } from '../auth/SessionProvider';

const roleNames = { ADMIN: '管理員', EDITOR: '協作者' };

function ActionPanel({ kind }: { kind: 'invitation' | 'transfer' }) {
    const { token = '' } = useParams();
    const navigate = useNavigate();
    const session = useSession();
    const base =
        kind === 'invitation'
            ? 'organization-invitations'
            : 'organization-ownership-transfers';
    const state = useResource<
        | { invitation: OrganizationInvitationDetail }
        | { transfer: OrganizationOwnershipTransferDetail }
    >(`/api/v1/${base}/${encodeURIComponent(token)}`);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const detail =
        state.data &&
        ('invitation' in state.data
            ? state.data.invitation
            : state.data.transfer);

    async function respond(action: 'accept' | 'decline') {
        setBusy(true);
        setError('');
        try {
            const result = await post<{ organizationId: string }>(
                `/api/v1/${base}/${encodeURIComponent(token)}/${action}`,
            );
            navigate(
                action === 'accept'
                    ? `/orgs/${result.organizationId}`
                    : '/organizations',
                { replace: true },
            );
        } catch (failure) {
            setError((failure as Error).message);
            setBusy(false);
        }
    }

    async function switchAccount() {
        setBusy(true);
        setError('');
        try {
            await session.signOut();
            navigate(
                `/login?returnTo=${encodeURIComponent(window.location.pathname)}`,
                { replace: true },
            );
        } catch (failure) {
            setError((failure as Error).message);
            setBusy(false);
        }
    }

    return (
        <section className="auth-card organization-action-page">
            <Feedback
                loading={state.loading}
                error={state.error}
                retry={state.reload}
            />
            {error && (
                <p className="notice error" role="alert">
                    {error}
                </p>
            )}
            {detail && (
                <>
                    <h1>
                        {kind === 'invitation'
                            ? `加入${detail.organizationName}`
                            : `接任${detail.organizationName}`}
                    </h1>
                    {kind === 'invitation' && 'role' in detail && (
                        <p>你將成為{roleNames[detail.role]}。</p>
                    )}
                    {kind === 'transfer' && 'fromName' in detail && (
                        <p>{detail.fromName} 邀請你接任負責人。</p>
                    )}
                    {detail.status !== 'PENDING' ? (
                        <p className="notice">此邀請已處理或失效。</p>
                    ) : !detail.accountMatches ? (
                        <>
                            <p className="notice" role="alert">
                                請切換至收到邀請的 Email 帳號。
                            </p>
                            <button
                                disabled={busy}
                                onClick={() => void switchAccount()}
                            >
                                切換帳號
                            </button>
                        </>
                    ) : (
                        <div className="actions">
                            <button
                                className="primary"
                                disabled={busy}
                                onClick={() => void respond('accept')}
                            >
                                {kind === 'invitation'
                                    ? '接受邀請'
                                    : '接受移轉'}
                            </button>
                            <button
                                disabled={busy}
                                onClick={() => void respond('decline')}
                            >
                                婉拒
                            </button>
                        </div>
                    )}
                </>
            )}
        </section>
    );
}

export const OrganizationInvitationPage = () => (
    <ActionPanel kind="invitation" />
);
export const OwnershipTransferPage = () => <ActionPanel kind="transfer" />;
