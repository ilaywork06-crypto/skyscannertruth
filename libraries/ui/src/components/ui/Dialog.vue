<script setup lang="ts">
import { X } from 'lucide-vue-next'
import { DialogClose, DialogContent, DialogDescription, DialogOverlay, DialogPortal, DialogRoot, DialogTitle } from 'reka-ui'
import { cn } from '../../lib/cn'
import { usePreferences } from '../../theme/preferences'

const widths = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl', '2xl': 'max-w-6xl' }
const props = withDefaults(
  defineProps<{
    title?: string
    description?: string
    size?: keyof typeof widths
    class?: string
    /** Refuse closing by Esc / outside click (e.g. a form with unsaved changes asks first). */
    persistent?: boolean
    /**
     * Stack above other open dialogs. A dialog whose host is mounted early (the app-wide confirm) otherwise
     * lands *under* a dialog opened later, because Vue's teleport anchors keep mount order in <body>.
     */
    raised?: boolean
  }>(),
  { size: 'md' },
)
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ attemptClose: [] }>()
const { direction } = usePreferences()

function block(e: Event) {
  if (props.persistent) {
    e.preventDefault()
    emit('attemptClose')
  }
}
</script>

<template>
  <DialogRoot v-model:open="open">
    <DialogPortal>
      <DialogOverlay :class="cn('fixed inset-0 animate-fade bg-black/40 backdrop-blur-[2px]', raised ? 'z-[80]' : 'z-50')" />
      <DialogContent
        :dir="direction"
        :class="cn(
          'fixed left-1/2 top-1/2 flex max-h-[calc(100vh-2rem)] w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col',
          'animate-in rounded-2xl border border-border bg-popover shadow-pop outline-none',
          raised ? 'z-[80]' : 'z-50',
          widths[size],
          props.class,
        )"
        @escape-key-down="block"
        @pointer-down-outside="block"
        @interact-outside="(e: Event) => persistent && e.preventDefault()"
      >
        <div class="flex items-start gap-3 px-6 pb-3 pt-5">
          <div
            v-if="$slots.icon"
            class="grid size-9 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary-soft-foreground [&_svg]:size-[18px]"
          >
            <slot name="icon" />
          </div>
          <div class="min-w-0 flex-1">
            <DialogTitle class="text-base font-semibold tracking-tight" dir="auto"><slot name="title">{{ title }}</slot></DialogTitle>
            <DialogDescription v-if="description || $slots.description" class="mt-1 text-[13px] text-muted-foreground">
              <slot name="description">{{ description }}</slot>
            </DialogDescription>
            <DialogDescription v-else class="sr-only">{{ title }}</DialogDescription>
          </div>
          <DialogClose
            v-if="!persistent"
            class="-me-2 -mt-1 rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X class="size-4" />
          </DialogClose>
          <button
            v-else
            type="button"
            class="-me-2 -mt-1 rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            @click="emit('attemptClose')"
          >
            <X class="size-4" />
          </button>
        </div>
        <div v-if="$slots.default" class="min-h-0 flex-1 overflow-y-auto px-6 pb-4 pt-1"><slot /></div>
        <div
          v-if="$slots.footer"
          class="flex flex-wrap items-center justify-end gap-2 rounded-b-2xl border-t border-border bg-muted/40 px-6 py-3"
        >
          <slot name="footer" />
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
