import { useState } from 'react';

export function ShelterReference({ value }: { value?: string | null }) {
    const [message, setMessage] = useState('');
    if (!value) return null;
    async function copy() {
        try {
            await navigator.clipboard.writeText(value!);
            setMessage('收容編號已複製');
        } catch {
            setMessage('無法自動複製，請選取編號手動複製。');
        }
    }
    return (
        <div className="shelter-reference">
            <p>
                收容編號：<span>{value}</span>
            </p>
            <button type="button" onClick={copy}>
                複製收容編號
            </button>
            <span role="status">{message}</span>
        </div>
    );
}
