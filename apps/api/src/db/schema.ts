// Every feature owns its tables; this barrel is what Drizzle and the app see.
export * from '../auth/schema.ts';
export * from '../catalog/schema.ts';
export * from '../orders/schema.ts';
export * from '../payments/schema.ts';
export * from '../tickets/schema.ts';
export * from '../staff/schema.ts';
