/**
 * Subscriptions (`/subscriptions`, events service) - mail notifications about an industry, an event type or
 * one event. Behind SUBSCRIPTIONS_ENABLED in the UI; the endpoints work either way.
 */
import { api } from './client'

export type SubscriptionTrigger = 'event_created' | 'event_updated' | 'entity_added' | 'entity_parsed'

export interface Subscription {
  id: string
  owner: string
  email: string
  industry: string | null
  event_id: string | null
  event_type_key: string | null
  triggers: SubscriptionTrigger[]
  active: boolean
  created_at: string
  last_notified_at: string | null
}

export interface SubscriptionCreateRequest {
  email: string
  industry: string | null
  event_id: string | null
  event_type_key: string | null
  triggers: SubscriptionTrigger[]
}

export const SUBSCRIPTION_TRIGGERS: SubscriptionTrigger[] = ['event_created', 'event_updated', 'entity_added', 'entity_parsed']
/** A single event cannot be told about its own upload. */
export const EVENT_TRIGGERS: SubscriptionTrigger[] = ['event_updated', 'entity_added', 'entity_parsed']
export const EVENT_DEFAULT_TRIGGERS: SubscriptionTrigger[] = ['entity_added', 'entity_parsed']
export const BROAD_DEFAULT_TRIGGERS: SubscriptionTrigger[] = ['event_created', 'entity_parsed']
/** The last mail address used, offered again next time. */
export const SUBSCRIPTION_EMAIL_KEY = 'skyscanner.email'

export const listSubscriptions = () => api<Subscription[]>('/subscriptions')
export const createSubscription = (request: SubscriptionCreateRequest) =>
  api<Subscription>('/subscriptions', { method: 'POST', json: request })
export const deleteSubscription = (id: string) => api(`/subscriptions/${encodeURIComponent(id)}`, { method: 'DELETE' })
