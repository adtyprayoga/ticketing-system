import type { AppDeps, PaymentProvider } from '../deps.ts';
import { createMidtransProvider } from './midtrans.ts';
import { createSimulatorProvider } from './simulator.ts';

/** The provider PAYMENT_PROVIDER selects. */
export function createPaymentProvider(
  deps: Pick<AppDeps, 'db' | 'clock' | 'config'>,
): PaymentProvider {
  return deps.config.paymentProvider === 'midtrans'
    ? createMidtransProvider(deps)
    : createSimulatorProvider(deps);
}
