const mockAddCallback = jest.fn();
const mockGauge = { addCallback: mockAddCallback };
const mockMeter = {
    createCounter: jest.fn(),
    createObservableGauge: jest.fn().mockReturnValue(mockGauge),
};

jest.mock('@opentelemetry/api', () => ({
    metrics: {
        getMeter: jest.fn().mockReturnValue(mockMeter),
    },
}));

jest.mock('../../../config/logger', () => ({
    __esModule: true,
    default: { error: jest.fn() },
}));

import { registerDbPoolGauge } from '../../../config/metrics';

describe('registerDbPoolGauge', () => {
    it('should register a callback with the ObservableGauge', () => {
        const mockPool = { totalCount: 5, idleCount: 3, waitingCount: 1 } as any;
        registerDbPoolGauge(mockPool);
        expect(mockAddCallback).toHaveBeenCalledTimes(1);
    });

    it('should observe total, idle, and waiting states from the pool', () => {
        const mockPool = { totalCount: 5, idleCount: 3, waitingCount: 1 } as any;
        registerDbPoolGauge(mockPool);

        const registeredCallback = mockAddCallback.mock.calls[0][0];
        const mockObservable = { observe: jest.fn() };
        registeredCallback(mockObservable);

        expect(mockObservable.observe).toHaveBeenCalledWith(5, { state: 'total' });
        expect(mockObservable.observe).toHaveBeenCalledWith(3, { state: 'idle' });
        expect(mockObservable.observe).toHaveBeenCalledWith(1, { state: 'waiting' });
    });
});
