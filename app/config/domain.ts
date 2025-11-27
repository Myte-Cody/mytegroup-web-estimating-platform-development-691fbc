const stripProtocol = (val?: string) => (val || '').replace(/^https?:\/\//, '').split('/')[0]
const parseHostPort = (val?: string) => {
  const cleaned = stripProtocol(val)
  if (!cleaned) return { host: undefined as string | undefined, port: undefined as number | undefined }
  const [host, port] = cleaned.split(':')
  return { host, port: port ? Number(port) : undefined }
}

const isProduction = process.env.NODE_ENV === 'production'
const rootDomainRaw = isProduction
  ? process.env.NEXT_PUBLIC_ROOT_DOMAIN_PROD || process.env.ROOT_DOMAIN_PROD || process.env.NEXT_PUBLIC_ROOT_DOMAIN || process.env.ROOT_DOMAIN
  : process.env.NEXT_PUBLIC_ROOT_DOMAIN_DEV || process.env.ROOT_DOMAIN_DEV || process.env.NEXT_PUBLIC_ROOT_DOMAIN || process.env.ROOT_DOMAIN

const { host: rootHost } = parseHostPort(rootDomainRaw)

const protocol = isProduction ? 'https' : 'http'
const defaultClientPort = Number(process.env.NEXT_PUBLIC_CLIENT_PORT || (isProduction ? 443 : 6666))
const defaultApiPort = Number(process.env.NEXT_PUBLIC_API_PORT || (isProduction ? 443 : 7070))

const portSegment = (val?: number) => {
  if (!val || Number.isNaN(val) || val === 80 || val === 443) return ''
  return `:${val}`
}

const buildOrigin = (host: string | undefined, port?: number) => {
  const safeHost = host || 'localhost'
  const portToUse = typeof port === 'number' && !Number.isNaN(port) ? port : undefined
  return `${protocol}://${safeHost}${portSegment(portToUse)}`
}

export const siteUrl = buildOrigin(rootHost, defaultClientPort)
export const apiUrl = buildOrigin(rootHost, defaultApiPort)

export const domainConfig = {
  rootDomain: rootHost || 'localhost',
  siteUrl,
  apiUrl,
  protocol,
}
