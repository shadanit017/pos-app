import { Injectable } from '@nestjs/common';
import { PaymentProvider, PaymentResult } from './payment.interface';

@Injectable()
export class DummyPaymentProvider implements PaymentProvider {
  async processPayment(
    amount: number,
    reference: string,
    options?: { simulate?: 'SUCCESS' | 'FAILED' },
  ): Promise<PaymentResult> {
    const transactionId = `txn_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    if (options?.simulate === 'FAILED') {
      return {
        status: 'FAILED',
        transactionId,
        provider: 'DUMMY_PAYMENT_GATEWAY',
        errorMessage: 'Simulated payment processing failure',
      };
    }

    return {
      status: 'SUCCESS',
      transactionId,
      provider: 'DUMMY_PAYMENT_GATEWAY',
    };
  }
}
