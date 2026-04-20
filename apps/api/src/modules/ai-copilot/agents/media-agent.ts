/**
 * Media Agent
 * - Searches YouTube for relevant videos using YouTube Data API v3
 * - Triggers image generation via OpenAI DALL-E or searches for stock images
 * - Resolves image_prompt and video_search blocks from content agent output
 */

import axios from 'axios'
import OpenAI from 'openai'
import { config } from '../../../config/index.js'

// ─── YouTube ──────────────────────────────────────────────────────────────────

export interface YouTubeVideo {
  videoId:     string
  title:       string
  channelName: string
  thumbnailUrl: string
  duration:    string // ISO 8601 e.g. PT4M13S
  viewCount:   string
  embedUrl:    string
  watchUrl:    string
}

export async function searchYouTube(
  query: string,
  maxResults = 3
): Promise<YouTubeVideo[]> {
  if (!config.youtube.apiKey) {
    console.warn('[media-agent] YOUTUBE_API_KEY not set — skipping video search')
    return []
  }

  // Search
  const searchResp = await axios.get(
    'https://www.googleapis.com/youtube/v3/search',
    {
      params: {
        key:        config.youtube.apiKey,
        q:          query,
        part:       'snippet',
        type:       'video',
        maxResults,
        relevanceLanguage: 'en',
        safeSearch: 'moderate',
      },
    }
  )

  const items = searchResp.data.items as Array<{
    id: { videoId: string }
    snippet: {
      title: string
      channelTitle: string
      thumbnails: { medium: { url: string } }
    }
  }>

  if (!items.length) return []

  // Fetch duration + stats
  const ids = items.map((i) => i.id.videoId).join(',')
  const detailResp = await axios.get(
    'https://www.googleapis.com/youtube/v3/videos',
    {
      params: {
        key:  config.youtube.apiKey,
        id:   ids,
        part: 'contentDetails,statistics',
      },
    }
  )

  const details = detailResp.data.items as Array<{
    id: string
    contentDetails: { duration: string }
    statistics: { viewCount: string }
  }>

  const detailMap = new Map(details.map((d) => [d.id, d]))

  return items.map((item) => {
    const videoId = item.id.videoId
    const detail = detailMap.get(videoId)
    return {
      videoId,
      title:        item.snippet.title,
      channelName:  item.snippet.channelTitle,
      thumbnailUrl: item.snippet.thumbnails.medium.url,
      duration:     detail?.contentDetails.duration ?? 'PT0S',
      viewCount:    detail?.statistics.viewCount ?? '0',
      embedUrl:     `https://www.youtube.com/embed/${videoId}`,
      watchUrl:     `https://www.youtube.com/watch?v=${videoId}`,
    }
  })
}

// ─── Image generation ─────────────────────────────────────────────────────────

export interface GeneratedImage {
  url:     string
  prompt:  string
  revised: string
  source:  'dalle' | 'placeholder'
}

export async function generateImage(
  prompt: string,
  size: '1024x1024' | '1792x1024' | '1024x1792' = '1792x1024'
): Promise<GeneratedImage> {
  if (!config.ai.openai) {
    // Return placeholder if no OpenAI key
    return {
      url:     `https://placehold.co/1792x1024/1a1a2e/ffffff?text=${encodeURIComponent(prompt.slice(0, 40))}`,
      prompt,
      revised: prompt,
      source:  'placeholder',
    }
  }

  const openai = new OpenAI({ apiKey: config.ai.openai })
  const resp = await openai.images.generate({
    model:           'dall-e-3',
    prompt:          `Educational illustration for an online course: ${prompt}. Clean, professional, modern style.`,
    n:               1,
    size,
    quality:         'standard',
    response_format: 'url',
  })

  const img = resp.data[0]
  return {
    url:     img?.url ?? '',
    prompt,
    revised: img?.revised_prompt ?? prompt,
    source:  'dalle',
  }
}

// ─── Batch enrichment ─────────────────────────────────────────────────────────

export interface MediaEnrichmentInput {
  videoSearchBlocks: Array<{ query: string; rationale: string; blockIndex: number }>
  imagePromptBlocks: Array<{ prompt: string; alt: string; blockIndex: number }>
}

export interface MediaEnrichmentResult {
  videos: Array<{ blockIndex: number; videos: YouTubeVideo[] }>
  images: Array<{ blockIndex: number; image: GeneratedImage }>
}

export async function enrichMedia(
  input: MediaEnrichmentInput
): Promise<MediaEnrichmentResult> {
  const [videoResults, imageResults] = await Promise.all([
    Promise.all(
      input.videoSearchBlocks.map(async (b) => ({
        blockIndex: b.blockIndex,
        videos: await searchYouTube(b.query, 3),
      }))
    ),
    Promise.all(
      input.imagePromptBlocks.map(async (b) => ({
        blockIndex: b.blockIndex,
        image: await generateImage(b.prompt),
      }))
    ),
  ])

  return { videos: videoResults, images: imageResults }
}
