import { useEffect, useRef } from 'react';
import { useBlocker } from 'react-router-dom';

/** Blocks internal links and browser back; beforeunload also protects reload/closing. */
export function useUnsavedListing(dirty: boolean) {
    const current = useRef(dirty);
    current.current = dirty;
    const blocker = useBlocker(() => current.current);
    useEffect(() => {
        if (blocker.state !== 'blocked') return;
        if (window.confirm('還有未儲存的內容，確定離開？')) blocker.proceed();
        else blocker.reset();
    }, [blocker]);
    useEffect(() => {
        const unload = (event: BeforeUnloadEvent) => {
            if (current.current) {
                event.preventDefault();
                event.returnValue = '';
            }
        };
        window.addEventListener('beforeunload', unload);
        return () => window.removeEventListener('beforeunload', unload);
    }, []);
    return () => {
        current.current = false;
    };
}
