import { useState, type FormEvent } from 'react';
import type {
    OrganizationMembershipWorkspace,
    OrganizationRole,
} from '../../../../src/contracts/organizations';
import { patch, post } from '../../api/client';
import { useResource } from '../../hooks/useResource';
import { Feedback } from '../../ui/Feedback';

const roleNames = { OWNER: '負責人', ADMIN: '管理員', EDITOR: '協作者' };

export function OrganizationMembers({
    organizationId,
}: {
    organizationId: string;
}) {
    const state = useResource<OrganizationMembershipWorkspace>(
        `/api/v1/organizations/${encodeURIComponent(organizationId)}/members`,
    );
    const [busy, setBusy] = useState('');
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');

    async function act(
        key: string,
        action: () => Promise<unknown>,
        success: string,
    ) {
        if (busy) return false;
        setBusy(key);
        setError('');
        setMessage('');
        try {
            await action();
            setMessage(success);
            state.reload();
            return true;
        } catch (failure) {
            setError((failure as Error).message);
            return false;
        } finally {
            setBusy('');
        }
    }

    async function invite(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const form = event.currentTarget;
        const values = Object.fromEntries(new FormData(form));
        const succeeded = await act(
            'invite',
            () =>
                post(
                    `/api/v1/organizations/${organizationId}/invitations`,
                    values,
                ),
            '邀請已排入寄送。',
        );
        if (succeeded) form.reset();
    }

    const data = state.data;
    return (
        <section
            className="panel organization-members"
            aria-labelledby="members-title"
        >
            <div className="section-heading">
                <h2 id="members-title">成員</h2>
                {data && (
                    <span className="muted">{data.members.length} 人</span>
                )}
            </div>
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
            {message && (
                <p className="notice" role="status">
                    {message}
                </p>
            )}
            {data && (
                <>
                    {data.capabilities.inviteRoles.length > 0 && (
                        <form className="member-invite" onSubmit={invite}>
                            <label>
                                Email
                                <input
                                    name="email"
                                    type="email"
                                    autoComplete="email"
                                    required
                                    maxLength={320}
                                />
                            </label>
                            <label>
                                權限
                                <select name="role" defaultValue="EDITOR">
                                    {data.capabilities.inviteRoles.includes(
                                        'EDITOR',
                                    ) && <option value="EDITOR">協作者</option>}
                                    {data.capabilities.inviteRoles.includes(
                                        'ADMIN',
                                    ) && <option value="ADMIN">管理員</option>}
                                </select>
                            </label>
                            <button
                                className="primary"
                                disabled={Boolean(busy)}
                            >
                                {busy === 'invite' ? '寄送中…' : '寄出邀請'}
                            </button>
                        </form>
                    )}

                    <ul className="member-list">
                        {data.members.map((member) => {
                            const manageable =
                                data.capabilities.canManageMembers &&
                                member.role !== 'OWNER' &&
                                !(
                                    data.capabilities.inviteRoles.length ===
                                        1 && member.role === 'ADMIN'
                                );
                            return (
                                <li className="member-row" key={member.userId}>
                                    <div>
                                        <strong>{member.name}</strong>
                                        {member.email && (
                                            <span className="muted">
                                                {member.email}
                                            </span>
                                        )}
                                    </div>
                                    <div className="member-actions">
                                        {manageable &&
                                        data.capabilities.inviteRoles.includes(
                                            'ADMIN',
                                        ) ? (
                                            <label>
                                                <select
                                                    aria-label={`${member.name}的角色`}
                                                    value={member.role}
                                                    disabled={Boolean(busy)}
                                                    onChange={(event) =>
                                                        void act(
                                                            `role-${member.userId}`,
                                                            () =>
                                                                patch(
                                                                    `/api/v1/organizations/${organizationId}/members/${encodeURIComponent(member.userId)}`,
                                                                    {
                                                                        role: event
                                                                            .target
                                                                            .value as OrganizationRole,
                                                                    },
                                                                ),
                                                            `${member.name}的權限已更新。`,
                                                        )
                                                    }
                                                >
                                                    <option value="EDITOR">
                                                        協作者
                                                    </option>
                                                    <option value="ADMIN">
                                                        管理員
                                                    </option>
                                                </select>
                                            </label>
                                        ) : (
                                            <span>
                                                {roleNames[member.role]}
                                            </span>
                                        )}
                                        {manageable &&
                                            data.capabilities
                                                .canTransferOwnership &&
                                            !data.transfer && (
                                                <button
                                                    disabled={Boolean(busy)}
                                                    onClick={() => {
                                                        if (
                                                            window.confirm(
                                                                `確定邀請 ${member.name} 接任負責人？接受前不會改變權限。`,
                                                            )
                                                        ) {
                                                            void act(
                                                                `transfer-${member.userId}`,
                                                                () =>
                                                                    post(
                                                                        `/api/v1/organizations/${organizationId}/ownership-transfers`,
                                                                        {
                                                                            toUserId:
                                                                                member.userId,
                                                                        },
                                                                    ),
                                                                '負責人移轉邀請已排入寄送。',
                                                            );
                                                        }
                                                    }}
                                                >
                                                    移轉給{member.name}
                                                </button>
                                            )}
                                        {manageable && (
                                            <button
                                                className="danger"
                                                disabled={Boolean(busy)}
                                                aria-label={`移除${member.name}`}
                                                onClick={() => {
                                                    if (
                                                        window.confirm(
                                                            `確定將 ${member.name} 移出這個中途之家？`,
                                                        )
                                                    ) {
                                                        void act(
                                                            `remove-${member.userId}`,
                                                            () =>
                                                                post(
                                                                    `/api/v1/organizations/${organizationId}/members/${encodeURIComponent(member.userId)}/remove`,
                                                                ),
                                                            `${member.name}已移除。`,
                                                        );
                                                    }
                                                }}
                                            >
                                                移除
                                            </button>
                                        )}
                                    </div>
                                </li>
                            );
                        })}
                    </ul>

                    {data.invitations.length > 0 && (
                        <div className="pending-members">
                            <h3>等待回覆</h3>
                            <ul className="member-list">
                                {data.invitations.map((invitation) => (
                                    <li
                                        className="member-row"
                                        key={invitation.id}
                                    >
                                        <div>
                                            <strong>{invitation.email}</strong>
                                            <span className="muted">
                                                {roleNames[invitation.role]}
                                            </span>
                                        </div>
                                        <button
                                            disabled={Boolean(busy)}
                                            onClick={() =>
                                                void act(
                                                    `revoke-${invitation.id}`,
                                                    () =>
                                                        post(
                                                            `/api/v1/organizations/${organizationId}/invitations/${invitation.id}/revoke`,
                                                        ),
                                                    '邀請已撤銷。',
                                                )
                                            }
                                        >
                                            撤銷邀請
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {data.transfer && (
                        <div className="notice ownership-transfer">
                            <p>等待 {data.transfer.toName} 確認接任負責人。</p>
                            <button
                                disabled={Boolean(busy)}
                                onClick={() =>
                                    void act(
                                        'revoke-transfer',
                                        () =>
                                            post(
                                                `/api/v1/organizations/${organizationId}/ownership-transfers/${data.transfer!.id}/revoke`,
                                            ),
                                        '負責人移轉已撤銷。',
                                    )
                                }
                            >
                                撤銷移轉
                            </button>
                        </div>
                    )}
                </>
            )}
        </section>
    );
}
