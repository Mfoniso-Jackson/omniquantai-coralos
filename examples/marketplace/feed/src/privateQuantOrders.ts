import type { OrderSide } from './privateQuantRisk.js'

export type OrderType = 'market' | 'limit'

export interface PrepareOrderRequest {
  portfolioId?: string
  signalId?: string
  riskApprovalId?: string
  symbol?: string
  side?: OrderSide | 'hold'
  type?: OrderType
  quantity?: number
  limitPrice?: number
  price?: number
  maxQuantity?: number
  riskApproved?: boolean
  riskReasons?: string[]
  mode?: 'paper'
}

export interface PreparedOrderResponse {
  id: string
  portfolioId: string
  signalId?: string
  riskApprovalId?: string
  symbol: string
  side: OrderSide
  type: OrderType
  quantity: number
  limitPrice?: number
  notional?: number
  status: 'prepared' | 'rejected'
  reasons: string[]
  mode: 'paper'
  createdAt: string
  engine: {
    provider: 'omniquant'
    model: 'deterministic-paper-order-prep-v1'
  }
}

export interface PaperTrade {
  id: string
  symbol: string
  side: OrderSide
  quantity: number
  entryPrice: number
  openedAt: number
  strategy?: string
}

export interface PaperAccount {
  balance?: number
  openPositions?: PaperTrade[]
  trades?: PaperTrade[]
}

export interface ExecuteOrderRequest {
  orderId?: string
  mode?: 'paper'
  account?: PaperAccount
  preparedOrder?: PreparedOrderResponse
  price?: number
  strategy?: string
}

export interface ExecutionResponse {
  id: string
  orderId: string
  mode: 'paper'
  status: 'filled' | 'rejected'
  filledQuantity?: number
  averagePrice?: number
  message: string
  reasons: string[]
  account: {
    balance: number
    openPositions: PaperTrade[]
    trades: PaperTrade[]
  }
  createdAt: string
  engine: {
    provider: 'omniquant'
    model: 'deterministic-paper-execution-v1'
  }
}

export function preparePrivateOrder(input: PrepareOrderRequest): PreparedOrderResponse {
  const createdAt = new Date().toISOString()
  const portfolioId = clean(input.portfolioId, 'portfolio')
  const symbol = clean(input.symbol, 'SYMBOL').toUpperCase()
  const side = input.side === 'sell' ? 'sell' : input.side === 'buy' ? 'buy' : undefined
  const type = input.type === 'limit' ? 'limit' : 'market'
  const requestedQuantity = positiveNumber(input.quantity, 0)
  const maxQuantity = positiveNumber(input.maxQuantity, Number.POSITIVE_INFINITY)
  const quantity = Math.min(requestedQuantity, maxQuantity)
  const price = positiveNumber(input.limitPrice ?? input.price, 0)
  const reasons: string[] = []

  if (input.mode && input.mode !== 'paper') reasons.push('Only paper order preparation is supported.')
  if (!side) reasons.push('Executable buy or sell side is required.')
  if (requestedQuantity <= 0) reasons.push('Quantity must be greater than zero.')
  if (quantity <= 0) reasons.push('Prepared quantity must be greater than zero.')
  if (type === 'limit' && positiveNumber(input.limitPrice, 0) <= 0) reasons.push('Limit price is required for limit orders.')
  if (input.riskApproved === false) reasons.push(...(input.riskReasons?.length ? input.riskReasons : ['Risk approval is required.']))

  const status = reasons.length === 0 ? 'prepared' : 'rejected'
  return {
    id: `ord_${portfolioId}_${symbol}_${Date.now()}`,
    portfolioId,
    signalId: input.signalId,
    riskApprovalId: input.riskApprovalId,
    symbol,
    side: side ?? 'buy',
    type,
    quantity,
    limitPrice: type === 'limit' ? input.limitPrice : undefined,
    notional: price > 0 && quantity > 0 ? price * quantity : undefined,
    status,
    reasons,
    mode: 'paper',
    createdAt,
    engine: {
      provider: 'omniquant',
      model: 'deterministic-paper-order-prep-v1',
    },
  }
}

export function executePrivatePaperOrder(input: ExecuteOrderRequest): ExecutionResponse {
  const createdAt = new Date().toISOString()
  const account = normalizeAccount(input.account)
  const order = input.preparedOrder
  const reasons: string[] = []
  const price = positiveNumber(input.price ?? order?.limitPrice, 0)

  if (input.mode !== 'paper') reasons.push('Only paper execution is supported.')
  if (!order) reasons.push('Prepared order is required.')
  if (order && order.status !== 'prepared') reasons.push(...(order.reasons.length ? order.reasons : ['Prepared order is not executable.']))
  if (order && order.quantity <= 0) reasons.push('Prepared order quantity must be greater than zero.')
  if (price <= 0) reasons.push('Execution price must be greater than zero.')

  if (reasons.length > 0 || !order) {
    return {
      id: `exec_${clean(input.orderId ?? order?.id, 'order')}_${Date.now()}`,
      orderId: clean(input.orderId ?? order?.id, 'order'),
      mode: 'paper',
      status: 'rejected',
      message: reasons.join(' ') || 'Paper order rejected.',
      reasons,
      account,
      createdAt,
      engine: {
        provider: 'omniquant',
        model: 'deterministic-paper-execution-v1',
      },
    }
  }

  const notional = order.quantity * price
  if (notional > account.balance) {
    reasons.push('Paper account balance is insufficient.')
    return {
      id: `exec_${order.id}_${Date.now()}`,
      orderId: order.id,
      mode: 'paper',
      status: 'rejected',
      message: reasons.join(' '),
      reasons,
      account,
      createdAt,
      engine: {
        provider: 'omniquant',
        model: 'deterministic-paper-execution-v1',
      },
    }
  }

  const trade: PaperTrade = {
    id: `paper-${order.id}`,
    symbol: order.symbol,
    side: order.side,
    quantity: order.quantity,
    entryPrice: price,
    openedAt: Date.now(),
    strategy: input.strategy,
  }

  return {
    id: `exec_${order.id}_${Date.now()}`,
    orderId: order.id,
    mode: 'paper',
    status: 'filled',
    filledQuantity: order.quantity,
    averagePrice: price,
    message: 'Paper order executed.',
    reasons: [],
    account: {
      balance: account.balance - notional,
      openPositions: [...account.openPositions, trade],
      trades: [...account.trades, trade],
    },
    createdAt,
    engine: {
      provider: 'omniquant',
      model: 'deterministic-paper-execution-v1',
    },
  }
}

function normalizeAccount(account: PaperAccount | undefined): Required<PaperAccount> {
  return {
    balance: positiveNumber(account?.balance, 0),
    openPositions: account?.openPositions ?? [],
    trades: account?.trades ?? [],
  }
}

function positiveNumber(value: unknown, fallback: number): number {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback
}

function clean(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value.trim().replace(/[^a-zA-Z0-9_-]/g, '') : fallback
}
