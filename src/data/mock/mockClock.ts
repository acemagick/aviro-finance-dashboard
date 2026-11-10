import { startOfDay } from 'date-fns';

/**
 * Mock dates are generated relative to "today", so the demo always
 * has recent data no matter when it is opened.
 */
export const MOCK_TODAY = startOfDay(new Date());
