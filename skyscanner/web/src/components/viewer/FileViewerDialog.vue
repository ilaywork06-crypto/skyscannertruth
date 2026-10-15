<script setup lang="ts">
/** A stored file opened from anywhere in the inventory: its name, size, a download, and the preview. */
import { Download } from 'lucide-vue-next'
import { Button, Dialog, formatBytes, translate as t } from '@truth-platform/ui'
import { computed } from 'vue'
import { downloadArtifact, type Artifact } from '@/api/artifacts'
import { fileIcon } from '@/lib/icons'
import FilePreview from './FilePreview.vue'

const props = defineProps<{ artifact: Artifact | null }>()
const open = defineModel<boolean>('open', { default: false })
const icon = computed(() => (props.artifact ? fileIcon(props.artifact.name, props.artifact.suffix, props.artifact.content_type) : null))
</script>

<template>
  <Dialog v-model:open="open" size="2xl">
    <template #icon><component :is="icon" v-if="icon" /></template>
    <template #title>
      <span class="flex min-w-0 items-center gap-2">
        <span class="truncate" dir="auto" :title="artifact?.name">{{ artifact?.name }}</span>
        <span class="shrink-0 text-xs font-normal tabular-nums text-muted-foreground">{{ formatBytes(artifact?.size_bytes) }}</span>
      </span>
    </template>
    <template #description>
      <Button v-if="artifact" size="xs" variant="ghost" class="-ms-2.5 mt-0.5" :aria-label="t('files.download')" @click="downloadArtifact(artifact)">
        <Download /> {{ t('files.download') }}
      </Button>
    </template>
    <FilePreview v-if="artifact && open" :artifact="artifact" @download="downloadArtifact" />
  </Dialog>
</template>
