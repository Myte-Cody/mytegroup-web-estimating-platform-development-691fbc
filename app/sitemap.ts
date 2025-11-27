import type { MetadataRoute } from 'next'
import { siteUrl } from './config/domain'

const routes = ['/', '/legal/privacy', '/legal/terms']

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date()
  return routes.map((route) => ({
    url: `${siteUrl}${route}`,
    lastModified,
    changeFrequency: 'weekly',
    priority: route === '/' ? 1 : 0.6,
  }))
}
