export interface PaymentResult {
  status: 'SUCCESS' | 'FAILED';
  transactionId: string;
  provider: string;
  errorMessage?: string;
}

export interface PaymentProvider {
  processPayment(
    amount: number,
    reference: string,
    options?: { simulate?: 'SUCCESS' | 'FAILED' },
  ): Promise<PaymentResult>;
}

export const PAYMENT_PROVIDER = 'PAYMENT_PROVIDER';
