import {
  processInvoicePayment,
  confirmPayment,
  processRefund,
  getPaymentHistory,
} from '@/lib/business-logic/payments'
import {
  getInvoiceById,
  updateInvoice,
} from '@/lib/db/invoices'
import {
  createPayment,
  getPaymentById,
  updatePayment,
  getCustomerCreditBalance,
  updateCustomerCreditBalance,
} from '@/lib/db/payments'
import {
  createPaymentIntent,
  confirmPaymentIntent,
  getOrCreateStripeCustomer,
} from '@/lib/payments/stripe'
import { mockInvoice, mockUser } from '@/tests/utils/mocks'

// Mock Stripe module before any imports
jest.mock('@/lib/payments/stripe', () => ({
  createPaymentIntent: jest.fn(),
  getPaymentIntent: jest.fn(),
  confirmPaymentIntent: jest.fn(),
  getOrCreateStripeCustomer: jest.fn(),
  createRefund: jest.fn(),
}))

// Mock Redis cache
jest.mock('@/lib/cache/redis', () => ({
  redis: {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  },
}))

// Mock dependencies
jest.mock('@/lib/db/invoices')
jest.mock('@/lib/db/payments')
jest.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: mockUser,
        error: null,
      }),
    })),
  })),
}))

const mockGetInvoiceById = getInvoiceById as jest.MockedFunction<typeof getInvoiceById>
const mockUpdateInvoice = updateInvoice as jest.MockedFunction<typeof updateInvoice>
const mockCreatePayment = createPayment as jest.MockedFunction<typeof createPayment>
const mockGetPaymentById = getPaymentById as jest.MockedFunction<typeof getPaymentById>
const mockUpdatePayment = updatePayment as jest.MockedFunction<typeof updatePayment>
const mockGetCustomerCreditBalance = getCustomerCreditBalance as jest.MockedFunction<typeof getCustomerCreditBalance>
const mockUpdateCustomerCreditBalance = updateCustomerCreditBalance as jest.MockedFunction<typeof updateCustomerCreditBalance>
const mockCreatePaymentIntent = createPaymentIntent as jest.MockedFunction<typeof createPaymentIntent>
const mockConfirmPaymentIntent = confirmPaymentIntent as jest.MockedFunction<typeof confirmPaymentIntent>
const mockGetOrCreateStripeCustomer = getOrCreateStripeCustomer as jest.MockedFunction<typeof getOrCreateStripeCustomer>

describe('processInvoicePayment', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('throws error when invoice not found', async () => {
    mockGetInvoiceById.mockResolvedValue(null)

    await expect(
      processInvoicePayment({
        invoiceId: 'invalid-id',
        customerId: 'user-123',
        paymentMethod: 'card',
      })
    ).rejects.toThrow('Invoice not found')
  })

  it('throws error when invoice is already paid', async () => {
    mockGetInvoiceById.mockResolvedValue({
      ...mockInvoice,
      status: 'paid',
    })

    await expect(
      processInvoicePayment({
        invoiceId: 'invoice-123',
        customerId: 'user-123',
        paymentMethod: 'card',
      })
    ).rejects.toThrow('already paid')
  })

  it('throws error when invoice belongs to different customer', async () => {
    mockGetInvoiceById.mockResolvedValue(mockInvoice)

    await expect(
      processInvoicePayment({
        invoiceId: 'invoice-123',
        customerId: 'different-user',
        paymentMethod: 'card',
      })
    ).rejects.toThrow('does not belong to this customer')
  })

  it('processes payment with credit balance only', async () => {
    mockGetInvoiceById.mockResolvedValue(mockInvoice)
    mockGetCustomerCreditBalance.mockResolvedValue(1000)
    mockCreatePayment.mockResolvedValue({
      id: 'payment-123',
      invoiceId: 'invoice-123',
      customerId: 'user-123',
      amount: 962.5,
      currency: 'USD',
      status: 'succeeded',
      paymentMethod: 'credit_balance',
      createdAt: new Date().toISOString(),
    } as any)

    const result = await processInvoicePayment({
      invoiceId: 'invoice-123',
      customerId: 'user-123',
      paymentMethod: 'credit_balance',
    })

    expect(result.payment.status).toBe('succeeded')
    expect(mockUpdateCustomerCreditBalance).toHaveBeenCalled()
    expect(mockUpdateInvoice).toHaveBeenCalledWith('invoice-123', {
      status: 'paid',
      paidDate: expect.any(String),
    })
  })

  it('creates payment intent for card payment', async () => {
    mockGetInvoiceById.mockResolvedValue(mockInvoice)
    mockGetOrCreateStripeCustomer.mockResolvedValue({
      id: 'cus_123',
      email: 'test@example.com',
    } as any)
    mockCreatePaymentIntent.mockResolvedValue({
      id: 'pi_123',
      client_secret: 'secret_123',
      status: 'requires_payment_method',
    } as any)
    mockCreatePayment.mockResolvedValue({
      id: 'payment-123',
      invoiceId: 'invoice-123',
      customerId: 'user-123',
      amount: 962.5,
      currency: 'USD',
      status: 'pending',
      paymentMethod: 'card',
      stripePaymentIntentId: 'pi_123',
      createdAt: new Date().toISOString(),
    } as any)

    const result = await processInvoicePayment({
      invoiceId: 'invoice-123',
      customerId: 'user-123',
      paymentMethod: 'card',
    })

    expect(result.payment.status).toBe('pending')
    expect(result.clientSecret).toBe('secret_123')
    expect(mockCreatePaymentIntent).toHaveBeenCalled()
  })

  it('processes partial payment with credit balance and card', async () => {
    mockGetInvoiceById.mockResolvedValue(mockInvoice)
    mockGetCustomerCreditBalance.mockResolvedValue(500)
    mockGetOrCreateStripeCustomer.mockResolvedValue({
      id: 'cus_123',
      email: 'test@example.com',
    } as any)
    mockCreatePaymentIntent.mockResolvedValue({
      id: 'pi_123',
      client_secret: 'secret_123',
      status: 'requires_payment_method',
    } as any)
    mockCreatePayment.mockResolvedValue({
      id: 'payment-123',
      invoiceId: 'invoice-123',
      customerId: 'user-123',
      amount: 962.5,
      currency: 'USD',
      status: 'pending',
      paymentMethod: 'card',
      creditBalanceUsed: 500,
      stripePaymentIntentId: 'pi_123',
      createdAt: new Date().toISOString(),
    } as any)

    const result = await processInvoicePayment({
      invoiceId: 'invoice-123',
      customerId: 'user-123',
      paymentMethod: 'both',
    })

    expect(result.payment.creditBalanceUsed).toBe(500)
    expect(mockUpdateCustomerCreditBalance).toHaveBeenCalledWith('user-123', -500)
    expect(mockCreatePaymentIntent).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 462.5, // 962.5 - 500
      })
    )
  })
})

describe('confirmPayment', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('throws error when payment not found', async () => {
    mockGetPaymentById.mockResolvedValue(null)

    await expect(
      confirmPayment('invalid-id')
    ).rejects.toThrow('Payment not found')
  })

  it('throws error when payment is not pending', async () => {
    mockGetPaymentById.mockResolvedValue({
      id: 'payment-123',
      status: 'succeeded',
    } as any)

    await expect(
      confirmPayment('payment-123')
    ).rejects.toThrow('not pending')
  })

  it('confirms payment and updates invoice', async () => {
    mockGetPaymentById.mockResolvedValue({
      id: 'payment-123',
      invoiceId: 'invoice-123',
      amount: 962.5,
      currency: 'USD',
      status: 'pending',
      stripePaymentIntentId: 'pi_123',
    } as any)
    mockConfirmPaymentIntent.mockResolvedValue({
      id: 'pi_123',
      status: 'succeeded',
      latest_charge: 'ch_123',
    } as any)
    mockUpdatePayment.mockResolvedValue({
      id: 'payment-123',
      status: 'succeeded',
    } as any)
    mockGetInvoiceById.mockResolvedValue(mockInvoice)

    const result = await confirmPayment('payment-123')

    expect(result.status).toBe('succeeded')
    expect(mockUpdateInvoice).toHaveBeenCalledWith('invoice-123', {
      status: 'paid',
      paidDate: expect.any(String),
    })
  })
})

describe('processRefund', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('throws error when payment not found', async () => {
    mockGetPaymentById.mockResolvedValue(null)

    await expect(
      processRefund({
        paymentId: 'invalid-id',
      })
    ).rejects.toThrow('Payment not found')
  })

  it('throws error when payment status is not succeeded', async () => {
    mockGetPaymentById.mockResolvedValue({
      id: 'payment-123',
      status: 'pending',
    } as any)

    await expect(
      processRefund({
        paymentId: 'payment-123',
      })
    ).rejects.toThrow('Cannot refund payment')
  })

  it('throws error when refund amount exceeds payment amount', async () => {
    mockGetPaymentById.mockResolvedValue({
      id: 'payment-123',
      amount: 100,
      status: 'succeeded',
    } as any)

    await expect(
      processRefund({
        paymentId: 'payment-123',
        amount: 200,
      })
    ).rejects.toThrow('cannot exceed payment amount')
  })

  it('processes refund to credit balance', async () => {
    const { createRefund } = await import('@/lib/db/payments')
    const mockCreateRefund = createRefund as jest.MockedFunction<typeof createRefund>

    mockGetPaymentById.mockResolvedValue({
      id: 'payment-123',
      invoiceId: 'invoice-123',
      customerId: 'user-123',
      amount: 100,
      currency: 'USD',
      status: 'succeeded',
      paymentMethod: 'credit_balance',
    } as any)
    mockCreateRefund.mockResolvedValue({
      id: 'refund-123',
      paymentId: 'payment-123',
      amount: 100,
      status: 'succeeded',
    } as any)
    mockUpdatePayment.mockResolvedValue({
      id: 'payment-123',
      status: 'refunded',
    } as any)
    mockGetInvoiceById.mockResolvedValue(mockInvoice)

    const result = await processRefund({
      paymentId: 'payment-123',
      refundToCredit: true,
    })

    expect(result.status).toBe('succeeded')
    expect(mockUpdateCustomerCreditBalance).toHaveBeenCalledWith('user-123', 100)
    expect(mockUpdateInvoice).toHaveBeenCalledWith('invoice-123', {
      status: 'pending',
    })
  })
})

