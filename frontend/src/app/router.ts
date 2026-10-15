/**
 * Routes. Pages are lazy-loaded so the first paint only carries what it shows.
 */

import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'

import { readStored } from '@/shared/utils/storage'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'home',
    /* Open where the reader left off: the industry last read, or the list of industries. */
    redirect: () => {
      const last = readStored('truth.industry.last')

      return last === null ? { name: 'industries' } : { name: 'industry', params: { id: last } }
    },
  },
  { path: '/industries', name: 'industries', component: () => import('@/pages/IndustriesPage.vue') },
  { path: '/industries/:id', name: 'industry', component: () => import('@/pages/IndustryRegisterPage.vue'), props: true },
  { path: '/assumptions/:id', name: 'assumption', component: () => import('@/pages/AssumptionPage.vue'), props: true },
  { path: '/schemas', name: 'schemas', component: () => import('@/pages/SchemasPage.vue') },
  { path: '/schemas/:id', name: 'schema', component: () => import('@/pages/SchemaPage.vue'), props: true },
  { path: '/:pathMatch(.*)*', name: 'not-found', component: () => import('@/pages/NotFoundPage.vue') },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior: (to, from, saved) => saved ?? (to.path === from.path ? undefined : { top: 0 }),
})

export default router
