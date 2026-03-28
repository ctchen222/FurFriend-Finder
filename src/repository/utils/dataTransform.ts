
export const getMetadata = <T>(data: T[]): Record<string, number> => {
	if (data.length === 0) {
		return {
			total: 0,
		};
	}

	const total = data.length;

	return {
		total,
	};
}
