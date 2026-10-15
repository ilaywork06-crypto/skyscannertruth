<script setup lang="ts">
/** The industries a declaration serves, as chips with their icons; none = all industries. */
import { Badge, localName, translate as t } from '@truth-platform/ui'
import { useIndustries } from '@/api/taxonomy'
import MdiIcon from './MdiIcon.vue'

defineProps<{ keys: (string | null)[] }>()
const { find } = useIndustries()
</script>

<template>
  <div class="flex flex-wrap gap-1">
    <template v-for="key in keys.filter((k): k is string => !!k)" :key="key">
      <Badge tone="neutral" class="gap-1.5">
        <MdiIcon :name="find(key)?.icon" />
        <span dir="auto">{{ find(key) ? localName(find(key)!) : key }}</span>
      </Badge>
    </template>
    <span v-if="!keys.filter(Boolean).length" class="text-xs text-muted-foreground">{{ t('common.allIndustries') }}</span>
  </div>
</template>
