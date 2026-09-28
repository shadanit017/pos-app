import { Inject, Injectable } from '@nestjs/common';
import { PAYMENT_PROVIDER, PaymentProvider, PaymentResult } from './payment.interface';

@Injectable()
export class PaymentService {
  constructor(
    @Inject(PAYMENT_PROVIDER) private readonly paymentProvider: PaymentProvider,
  ) {}

  async processPayment(
    amount: number,
    reference: string,
    options?: { simulate?: 'SUCCESS' | 'FAILED' },
  ): Promise<PaymentResult> {
    return this.paymentProvider.processPayment(amount, reference, options);
  }
}
