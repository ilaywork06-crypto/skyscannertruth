/**
 * Which platforms belong to which industries, as the client reads it.
 *
 * A platform is declared for the industries it serves. One declared before that was asked for serves every
 * industry, and it keeps doing so until somebody links it to some; the service stores exactly that and the
 * client offers it accordingly.
 */

import type { Platform } from '@/models/platform'

/**
 * Whether an event of an industry may name a platform: the platform lists that industry, or lists none.
 */
const platformServes = (platform: Platform, industry: string): boolean =>
  platform.industries.length === 0 || platform.industries.includes(industry)

/**
 * The platforms an event of an industry may name, in the order they were handed over.
 */
const platformsOf = (platforms: Platform[], industry: string | null): Platform[] =>
  industry === null ? [] : platforms.filter((platform) => platformServes(platform, industry))

export { platformServes, platformsOf }
