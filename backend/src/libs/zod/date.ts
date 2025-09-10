import { z } from "zod";

export const flexibleDateSchema = z.preprocess((arg) => {
	if (typeof arg === 'string') {
		return arg.replace(/\//g, '-');
	}
	return arg;
},
	z.string().date("無效的日期格式，應為 YYYY-MM-DD"));

