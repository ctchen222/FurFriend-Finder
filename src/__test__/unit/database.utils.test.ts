import DatabaseUtils from "../../libs/database.utils";

describe('DatabaseUtils.cursorPairGenerate', () => {
	it('should return undefined cursors for empty data', () => {
		const result = DatabaseUtils.cursorPairGenerate([], null, 10);
		expect(result.prevCursor).toBeUndefined();
		expect(result.nextCursor).toBeUndefined();
	});

	it('should not generate prevCursor on first page (no cursor)', () => {
		const data = [{ id: 11 }, { id: 12 }];
		const result = DatabaseUtils.cursorPairGenerate(data, null, 10);
		expect(result.prevCursor).toBeUndefined();
	});

	it('should generate nextCursor only when page is full', () => {
		const data = Array.from({ length: 10 }, (_, i) => ({
			id: i + 1,
			update_date: '2026-05-01',
			open_date: '2026-04-01',
		}));
		const result = DatabaseUtils.cursorPairGenerate(data, null, 10);
		const decoded = JSON.parse(Buffer.from(result.nextCursor!, 'base64').toString());
		expect(decoded.id).toBe(10);
		expect(decoded.update_date).toBe('2026-05-01');
		expect(decoded.open_date).toBe('2026-04-01');
	});

	it('should not generate nextCursor when page is not full', () => {
		const data = [{ id: 21 }, { id: 22 }, { id: 23 }];
		const result = DatabaseUtils.cursorPairGenerate(data, null, 10);
		expect(result.nextCursor).toBeUndefined();
	});

	it('should generate prevCursor when a cursor is provided (not first page)', () => {
		const data = [
			{ id: 11, update_date: '2026-05-01', open_date: '2026-04-01' },
			{ id: 12, update_date: '2026-04-30', open_date: '2026-04-01' },
		];
		const cursor = Buffer.from(JSON.stringify({ id: 10 })).toString('base64');
		const result = DatabaseUtils.cursorPairGenerate(data, cursor, 10);
		const decoded = JSON.parse(Buffer.from(result.prevCursor!, 'base64').toString());
		expect(decoded).toEqual({
			id: 11,
			update_date: '2026-05-01',
			open_date: '2026-04-01',
		});
	});

	it('should handle data with missing id gracefully', () => {
		const data = [{ name: 'foo' }, { id: 42 }];
		const result = DatabaseUtils.cursorPairGenerate(data, null, 10);
		expect(result.prevCursor).toBeUndefined();
		expect(result.nextCursor).toBeUndefined(); // only 2 items, page not full
	});
});
