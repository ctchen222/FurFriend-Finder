import { getOrganizationLimits } from '../../config/organizationLimits';

export class PhotoWorkLimiter {
    private active = 0;

    constructor(
        private readonly capacity = getOrganizationLimits()
            .photoProcessingConcurrency,
    ) {
        if (!Number.isSafeInteger(capacity) || capacity < 1 || capacity > 32) {
            throw new Error(
                'Photo processing capacity must be an integer between 1 and 32',
            );
        }
    }

    tryAcquire(): (() => void) | null {
        if (this.active >= this.capacity) return null;
        this.active++;
        let released = false;
        return () => {
            if (released) return;
            released = true;
            this.active--;
        };
    }
}

// All default service instances in this process share the same Sharp budget.
let processLimiter: PhotoWorkLimiter | undefined;
export function getProcessPhotoWorkLimiter(): PhotoWorkLimiter {
    return (processLimiter ??= new PhotoWorkLimiter());
}
