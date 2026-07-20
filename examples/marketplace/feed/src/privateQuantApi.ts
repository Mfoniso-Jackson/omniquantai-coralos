import type { Express, Request, Response } from 'express'

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

  app.post('/v1/backtests', notImplemented('run backtests', '/v1/backtests'))
  app.post('/v1/signals/generate', notImplemented('generate trading signals', '/v1/signals/generate'))
  app.post('/v1/risk/evaluate', notImplemented('evaluate deterministic risk controls', '/v1/risk/evaluate'))
  app.post('/v1/orders/prepare', notImplemented('prepare paper-trading orders', '/v1/orders/prepare'))
  app.post('/v1/orders/execute', notImplemented('execute paper-trading orders', '/v1/orders/execute'))
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
