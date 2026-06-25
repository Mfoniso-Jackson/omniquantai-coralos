'use client'

import { useState } from 'react'
import { useWallet, useConnection } from '@solana/wallet-adapter-react'
import { PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js'
import { Header } from '@/components/Header'

const API = process.env.NEXT_PUBLIC_API_SERVER ?? 'http://localhost:8081'
const EXPLORER = 'https://explorer.solana.com/tx'
const SELLER_WALLET = process.env.NEXT_PUBLIC_SELLER_WALLET ?? ''
const PRICE_SOL = parseFloat(process.env.NEXT_PUBLIC_PRICE_SOL ?? '0.00005')

type Step = 'idle' | 'connecting' | 'paying' | 'confirming' | 'done' | 'error'

interface Result {
  txSig: string
  data: string
}

const TOPICS = ['solana', 'bitcoin', 'defi', 'nft', 'ai agents']

export default function Track3Page() {
  const { publicKey, sendTransaction, connected } = useWallet()
  const { connection } = useConnection()
  const [topic, setTopic] = useState('solana')
  const [step, setStep] = useState<Step>('idle')
  const [result, setResult] = useState<Result | null>(null)
  const [error, setError] = useState('')

  const pay = async () => {
    if (!publicKey || !SELLER_WALLET) return
    setStep('paying')
    setError('')
    setResult(null)

    try {
      // Build transaction
      const tx = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: new PublicKey(SELLER_WALLET),
          lamports: Math.round(PRICE_SOL * LAMPORTS_PER_SOL),
        }),
      )
      const { blockhash } = await connection.getLatestBlockhash()
      tx.recentBlockhash = blockhash
      tx.feePayer = publicKey

      // Phantom signs + broadcasts
      const sig = await sendTransaction(tx, connection)
      setStep('confirming')

      // Wait for confirmation
      await connection.confirmTransaction(sig, 'confirmed')

      // Call api-ts to deliver the service
      setStep('confirming')
      const deliveryRes = await fetch(`${API}/api/v1/weather`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-payment-proof': sig },
        body: JSON.stringify({ city: topic }),
      })

      const delivery = await deliveryRes.json()
      setResult({ txSig: sig, data: JSON.stringify(delivery, null, 2) })
      setStep('done')
    } catch (e) {
      setError(String(e))
      setStep('error')
    }
  }

  const stepLabel: Record<Step, string> = {
    idle: `Pay ${PRICE_SOL} SOL →`,
    connecting: 'Connecting…',
    paying: 'Waiting for Phantom…',
    confirming: 'Confirming on-chain…',
    done: 'Delivered ✓',
    error: 'Failed — try again',
  }

  return (
    <div className="min-h-screen">
      <Header />
      <main className="max-w-lg mx-auto px-4 py-16">

        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 badge-green mb-4 px-3 py-1">
            <span className="w-1.5 h-1.5 rounded-full bg-solana-green animate-pulse" />
            <span className="text-xs">Track 3 — Consumer Checkout</span>
          </div>
          <h1 className="text-3xl font-bold mb-2">⚡ Instant Crypto News</h1>
          <p className="text-gray-400 text-sm">
            Pay {PRICE_SOL} SOL (~${(PRICE_SOL * 200).toFixed(3)}) · Get top headlines instantly · No account needed
          </p>
        </div>

        <div className="card space-y-5">
          {/* Topic selector */}
          <div>
            <label className="text-xs text-gray-400 font-medium block mb-2">Topic</label>
            <div className="flex flex-wrap gap-2">
              {TOPICS.map(t => (
                <button
                  key={t}
                  onClick={() => setTopic(t)}
                  className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                    topic === t ? 'bg-brand text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Wallet status */}
          {connected && publicKey && (
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <span className="w-1.5 h-1.5 rounded-full bg-solana-green" />
              {publicKey.toBase58().slice(0, 8)}…{publicKey.toBase58().slice(-4)}
            </div>
          )}

          {/* Pay button */}
          {connected ? (
            <button
              onClick={pay}
              disabled={step !== 'idle' && step !== 'error' && step !== 'done'}
              className="btn-primary w-full text-sm disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {stepLabel[step]}
            </button>
          ) : (
            <p className="text-center text-xs text-brand">Connect Phantom wallet (top right) to pay</p>
          )}

          {/* Error */}
          {step === 'error' && (
            <p className="text-xs text-red-400 text-center">{error}</p>
          )}
        </div>

        {/* Result */}
        {result && (
          <div className="mt-6 card space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-solana-green">✅ Paid & Delivered</p>
              <a
                href={`${EXPLORER}/${result.txSig}?cluster=devnet`}
                target="_blank" rel="noopener noreferrer"
                className="text-xs text-gray-400 underline"
              >
                {result.txSig.slice(0, 8)}…↗
              </a>
            </div>
            <pre className="text-xs text-gray-300 bg-black/40 rounded p-3 overflow-x-auto whitespace-pre-wrap">
              {result.data}
            </pre>
            <button onClick={() => { setStep('idle'); setResult(null) }} className="text-xs text-brand underline">
              Buy again
            </button>
          </div>
        )}

        {/* Fork hint */}
        <div className="mt-8 card border-brand/20">
          <p className="text-xs font-semibold text-brand uppercase tracking-wide mb-2">Fork this track</p>
          <p className="text-xs text-gray-400">Change what users receive after paying — one file:</p>
          <pre className="text-xs text-gray-300 bg-black/40 rounded p-3 mt-2 overflow-x-auto">
{`// coral-agents/seller-agent/src/service.ts
export async function deliverService(request: string) {
  // ← your service here
}`}
          </pre>
        </div>

      </main>
    </div>
  )
}
