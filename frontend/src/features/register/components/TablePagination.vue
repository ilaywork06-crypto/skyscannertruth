<template>
  <div class="pager">
    <span class="pager__range tabular">
      {{ total === 0 ? t('pagination.empty') : t('pagination.range', { first, last, total }) }}
    </span>
    <v-spacer />
    <span class="pager__label">{{ t('pagination.perPage') }}</span>
    <v-select
      :model-value="pageSize"
      :items="PAGE_SIZES"
      density="compact"
      variant="outlined"
      class="pager__size"
      @update:model-value="emit('update:pageSize', Number($event))"
    />
    <v-pagination
      v-if="pageCount > 1"
      :model-value="page"
      :length="pageCount"
      :total-visible="5"
      density="comfortable"
      rounded="lg"
      active-color="primary"
      size="small"
      @update:model-value="emit('update:page', $event)"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import { PAGE_SIZES } from '@/domain/register/view-url'
import { useI18n } from '@/i18n'

const props = defineProps<{ page: number; pageSize: number; pageCount: number; total: number }>()
const emit = defineEmits<{ 'update:page': [page: number]; 'update:pageSize': [size: number] }>()

const { t } = useI18n()

const first = computed(() => (props.page - 1) * props.pageSize + 1)
const last = computed(() => Math.min(props.page * props.pageSize, props.total))
</script>

<style scoped>
.pager {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
}

.pager__range,
.pager__label {
  font-size: 0.8125rem;
  color: rgb(var(--v-theme-muted));
}

.pager__size {
  flex: 0 0 5.5rem;
}
</style>
