import { Module } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { DummyPaymentProvider } from './dummy-payment.provider';
import { PAYMENT_PROVIDER } from './payment.interface';

@Module({
  providers: [
    PaymentService,
    {
      provide: PAYMENT_PROVIDER,
      useClass: DummyPaymentProvider,
    },
  ],
  exports: [PaymentService, PAYMENT_PROVIDER],
})
export class PaymentsModule {}
