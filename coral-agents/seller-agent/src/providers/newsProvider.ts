import { mockHeadlines, type NewsHeadline } from './mockDataProvider.js'

const cache = new Map<string, NewsHeadline[]>()

export async function getNewsHeadlines(symbol = 'NVDA'): Promise<NewsHeadline[]> {
  const key = `news:${symbol}`
  const cached = cache.get(key)
  if (cached) return cached
  try {
    const live = process.env.FINNHUB_API_KEY
      ? await finnhubNews(symbol, process.env.FINNHUB_API_KEY)
      : process.env.NEWS_API_KEY
        ? await newsApi(symbol, process.env.NEWS_API_KEY)
        : undefined
    if (!live?.length) throw new Error('no news API key configured')
    cache.set(key, live)
    return live
  } catch (error) {
    const fallback = mockHeadlines((error as Error).message)
    cache.set(key, fallback)
    return fallback
  }
}

async function finnhubNews(symbol: string, token: string): Promise<NewsHeadline[]> {
  const to = new Date()
  const from = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const fmt = (date: Date) => date.toISOString().slice(0, 10)
  const url = `https://finnhub.io/api/v1/company-news?symbol=${encodeURIComponent(symbol)}&from=${fmt(from)}&to=${fmt(to)}&token=${encodeURIComponent(token)}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Finnhub news ${res.status}`)
  const data = await res.json() as Array<{ headline?: string; source?: string; url?: string; datetime?: number }>
  return data.slice(0, 3).map((item) => ({
    title: item.headline ?? 'Untitled headline',
    source: item.source ?? 'Finnhub',
    url: item.url,
    timestamp: item.datetime ? new Date(item.datetime * 1000).toISOString() : new Date().toISOString(),
  }))
}

async function newsApi(symbol: string, token: string): Promise<NewsHeadline[]> {
  const query = symbol.toUpperCase() === 'NVDA' ? 'Nvidia OR NVDA' : symbol
  const url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(query)}&language=en&pageSize=3&sortBy=publishedAt&apiKey=${encodeURIComponent(token)}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`NewsAPI ${res.status}`)
  const data = await res.json() as { articles?: Array<{ title?: string; source?: { name?: string }; url?: string; publishedAt?: string }> }
  return (data.articles ?? []).slice(0, 3).map((item) => ({
    title: item.title ?? 'Untitled headline',
    source: item.source?.name ?? 'NewsAPI',
    url: item.url,
    timestamp: item.publishedAt ?? new Date().toISOString(),
  }))
}
