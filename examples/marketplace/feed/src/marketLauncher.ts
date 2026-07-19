import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

export const MARKET_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

export interface LaunchResult {
  session: string
  namespace: string
  log: string
}

export function launcherCommand(): { cmd: string; args: string[] } {
  const localTsx = join(MARKET_DIR, 'node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx')
  if (existsSync(localTsx)) return { cmd: localTsx, args: ['start.ts'] }
  return { cmd: 'npx', args: ['tsx', 'start.ts'] }
}

export function parseLauncherSession(text: string, fallbackNamespace: string): { session: string; namespace: string } | null {
  const primary = text.match(/(?:OmniQuantAI\s+)?market session (\S+)(?:\s+namespace\s+([A-Za-z0-9_.-]+))?/i)
  if (primary) return { session: primary[1], namespace: primary[2] ?? fallbackNamespace }
  const session = text.match(/session id:\s*(\S+)/i)?.[1]
  if (!session) return null
  const namespace = text.match(/namespace:\s*([A-Za-z0-9_.-]+)/i)?.[1] ?? fallbackNamespace
  return { session, namespace }
}

export function launchMarketSession(input: {
  namespace: string
  timeoutMs: number
  env?: NodeJS.ProcessEnv
  onSession?: (result: LaunchResult) => void
}): Promise<LaunchResult> {
  const launcher = launcherCommand()
  const child = spawn(launcher.cmd, launcher.args, { cwd: MARKET_DIR, shell: false, env: input.env ?? process.env })
  let buf = ''
  let matched = false

  return new Promise((resolve, reject) => {
    const finish = (result: LaunchResult) => {
      if (matched) return
      matched = true
      input.onSession?.(result)
      resolve(result)
    }
    const fail = (error: Error) => {
      if (matched) return
      matched = true
      reject(error)
    }
    const timer = setTimeout(() => fail(new Error(`launcher timed out: ${buf.slice(-800)}`)), input.timeoutMs)
    const onData = (d: Buffer) => {
      buf += d.toString()
      const parsed = parseLauncherSession(buf, input.namespace)
      if (parsed) {
        clearTimeout(timer)
        finish({ ...parsed, log: buf })
      }
    }
    child.stdout.on('data', onData)
    child.stderr.on('data', onData)
    child.on('error', (error) => {
      clearTimeout(timer)
      fail(new Error(`launcher failed to start: ${(error as Error).message}`))
    })
    child.on('exit', (code) => {
      clearTimeout(timer)
      if (matched) return
      fail(new Error(`launcher exited ${code} without a session: ${buf.slice(-4000)}`))
    })
  })
}
