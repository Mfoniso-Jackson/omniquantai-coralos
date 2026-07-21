import type { Express, Request, Response } from 'express'
import { runPrivateBacktest } from './privateQuantBacktest.js'
import { evaluatePrivateRisk } from './privateQuantRisk.js'
import { generatePrivateSignal } from './privateQuantSignals.js'
import { executePrivatePaperOrder, preparePrivateOrder } from './privateQuantOrders.js'

export const PRIVATE_QUANT_API_VERSION = 'v1'

export interface PrivateQuantModel {
  id: string
  name: string
  version: string
  status: 'active' | 'deprecated' | 'experimental'
}

export interface PrivateQuantError {
  error: {
    code: 'not_implemented'
    message: string
    owner: 'OmniQuantAI'
    plannedEndpoint: string
  }
}

export function installPrivateQuantApi(app: Express): void {
  app.get('/v1/health', (_req, res) => {
    res.json(privateQuantHealth())
  })

  app.get('/v1/models', (_req, res) => {
    res.json({ models: privateQuantModels() })
  })

  app.post('/v1/backtests', runBacktestHandler)
  app.post('/v1/signals/generate', generateSignalHandler)
  app.post('/v1/risk/evaluate', evaluateRiskHandler)
  app.post('/v1/orders/prepare', prepareOrderHandler)
  app.post('/v1/orders/execute', executeOrderHandler)
}

export function runBacktestHandler(req: Request, res: Response): void {
  try {
    res.status(201).json(runPrivateBacktest(req.body))
  } catch (error) {
    res.status(400).json({
      error: {
        code: 'invalid_backtest_request',
        message: (error as Error).message,
        owner: 'OmniQuantAI',
      },
    })
  }
}

export function generateSignalHandler(req: Request, res: Response): void {
  try {
    res.status(201).json(generatePrivateSignal(req.body))
  } catch (error) {
    res.status(400).json({
      error: {
        code: 'invalid_signal_request',
        message: (error as Error).message,
        owner: 'OmniQuantAI',
      },
    })
  }
}

export function prepareOrderHandler(req: Request, res: Response): void {
  try {
    res.status(201).json(preparePrivateOrder(req.body))
  } catch (error) {
    res.status(400).json({
      error: {
        code: 'invalid_order_request',
        message: (error as Error).message,
        owner: 'OmniQuantAI',
      },
    })
  }
}

export function executeOrderHandler(req: Request, res: Response): void {
  try {
    res.status(201).json(executePrivatePaperOrder(req.body))
  } catch (error) {
    res.status(400).json({
      error: {
        code: 'invalid_execution_request',
        message: (error as Error).message,
        owner: 'OmniQuantAI',
      },
    })
  }
}

export function evaluateRiskHandler(req: Request, res: Response): void {
  try {
    res.status(201).json(evaluatePrivateRisk(req.body))
  } catch (error) {
    res.status(400).json({
      error: {
        code: 'invalid_risk_request',
        message: (error as Error).message,
        owner: 'OmniQuantAI',
      },
    })
  }
}

export function privateQuantHealth() {
  return {
    ok: true,
    service: 'omniquantai-private-api',
    version: PRIVATE_QUANT_API_VERSION,
    status: 'boundary-ready',
  }
}

export function privateQuantModels(): PrivateQuantModel[] {
  return []
}

export function privateQuantNotImplemented(operation: string, endpoint: string): PrivateQuantError {
  return {
    error: {
      code: 'not_implemented',
      message: `OmniQuantAI private API can ${operation} after the quant engine migration is implemented.`,
      owner: 'OmniQuantAI',
      plannedEndpoint: endpoint,
    },
  }
}

function notImplemented(operation: string, endpoint: string) {
  return (_req: Request, res: Response) => {
    res.status(501).json(privateQuantNotImplemented(operation, endpoint))
  }
}
