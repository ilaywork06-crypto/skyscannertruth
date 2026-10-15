import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { SUBSCRIPTIONS_ENABLED } from './features'

const routes: RouteRecordRaw[] = [
  { path: '/', redirect: '/events' },
  { path: '/events', name: 'inventory', component: () => import('./pages/InventoryPage.vue'), meta: { wide: true } },
  { path: '/events/:id', name: 'event', component: () => import('./pages/EventPage.vue') },
  { path: '/schema', name: 'schema', component: () => import('./pages/SchemaPage.vue') },
  { path: '/types', name: 'types', component: () => import('./pages/TypesPage.vue') },
  { path: '/platforms', name: 'platforms', component: () => import('./pages/PlatformsPage.vue') },
  { path: '/industries', name: 'industries', component: () => import('./pages/IndustriesPage.vue') },
  {
    // An address from before the industry tabs: keep it leading where it led.
    path: '/industries/:key',
    redirect: (to) => ({ path: '/events', query: { industries: String(to.params.key) } }),
  },
  { path: '/subscriptions', name: 'subscriptions', component: () => import('./pages/SubscriptionsPage.vue') },
  { path: '/:pathMatch(.*)*', name: 'not-found', component: () => import('./pages/NotFoundPage.vue') },
]

export const router = createRouter({ history: createWebHistory(), routes })

router.beforeEach((to) => {
  if (!SUBSCRIPTIONS_ENABLED && to.path.startsWith('/subscriptions')) return '/events'
})
