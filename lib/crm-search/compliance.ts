export function shouldSuppressDomain(domain: string, suppressedDomains: string[]): boolean {
  return suppressedDomains.some((entry) => entry.toLowerCase() === domain.toLowerCase())
}
