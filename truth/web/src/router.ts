import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  { path: '/', name: 'landing', component: () => import('./pages/LandingPage.vue') },
  { path: '/industries', name: 'industries', component: () => import('./pages/IndustriesPage.vue') },
  { path: '/industries/:id', name: 'industry', component: () => import('./pages/IndustryPage.vue'), meta: { wide: true } },
  { path: '/assumptions/:id', name: 'assumption', component: () => import('./pages/AssumptionPage.vue') },
  { path: '/schemas', name: 'schemas', component: () => import('./pages/SchemasPage.vue') },
  { path: '/schemas/:id', name: 'schema', component: () => import('./pages/SchemaPage.vue') },
  { path: '/:pathMatch(.*)*', name: 'not-found', component: () => import('./pages/NotFoundPage.vue') },
]

export const router = createRouter({ history: createWebHistory(), routes })
