import { describe, expect, it } from 'vitest'
import { privateQuantHealth, privateQuantModels, privateQuantNotImplemented } from './privateQuantApi.js'

describe('private quant API boundary', () => {
  it('identifies the MassifX-facing private API as boundary-ready', () => {
    expect(privateQuantHealth()).toEqual({
      ok: true,
      service: 'omniquantai-private-api',
      version: 'v1',
      status: 'boundary-ready',
    })
  })

  it('starts with an empty model registry projection', () => {
    expect(privateQuantModels()).toEqual([])
  })

  it('returns explicit not-implemented errors for planned quant endpoints', () => {
    expect(privateQuantNotImplemented('run backtests', '/v1/backtests')).toEqual({
      error: {
        code: 'not_implemented',
        message: 'OmniQuantAI private API can run backtests after the quant engine migration is implemented.',
        owner: 'OmniQuantAI',
        plannedEndpoint: '/v1/backtests',
      },
    })
  })
})
