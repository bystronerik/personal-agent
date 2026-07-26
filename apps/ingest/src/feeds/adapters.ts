import { type ParsedFeed, parseFeed } from './rss'

export type Adapter = (body: string) => ParsedFeed

/**
 * Every source in the starting set is RSS 2.0, so there is one entry. The column
 * exists because the next source will not be — AP's Media API and the BLS series
 * API are both JSON — and a row naming its parser is what keeps that from
 * becoming a branch in the poller.
 */
const ADAPTERS: Record<string, Adapter> = {
  rss: parseFeed,
}

export const adapterFor = (name: string): Adapter | undefined => ADAPTERS[name]

export const adapterNames = (): string[] => Object.keys(ADAPTERS)
