<script setup lang="ts">
/** Theme, colour theme and language - the same menu in both clients, opened from the header. */
import { Check, Languages, Monitor, Moon, Palette, Sun } from 'lucide-vue-next'
import { ACCENTS, swatch } from '../../theme/palette'
import { usePreferences, type ThemeMode } from '../../theme/preferences'
import { translate as t } from '../../i18n'
import { cn } from '../../lib/cn'
import Menu from '../ui/Menu.vue'
import MenuItem from '../ui/MenuItem.vue'
import MenuLabel from '../ui/MenuLabel.vue'
import MenuSeparator from '../ui/MenuSeparator.vue'
import Tooltip from '../ui/Tooltip.vue'

const prefs = usePreferences()
const themes: { value: ThemeMode; icon: typeof Sun; key: string }[] = [
  { value: 'light', icon: Sun, key: 'prefs.light' },
  { value: 'dark', icon: Moon, key: 'prefs.dark' },
  { value: 'system', icon: Monitor, key: 'prefs.system' },
]
const swatches = ACCENTS.map((a) => ({ accent: a, ...swatch(a) }))
</script>

<template>
  <Menu class="w-72">
    <template #trigger><slot /></template>
    <slot name="header" />
    <MenuLabel>{{ t('prefs.theme') }}</MenuLabel>
    <div class="grid grid-cols-3 gap-1 px-1.5 pb-1.5">
      <button
        v-for="th in themes"
        :key="th.value"
        type="button"
        :class="cn(
          'flex flex-col items-center gap-1 rounded-lg border border-transparent py-2 text-xs text-muted-foreground hover:bg-muted',
          prefs.theme.value === th.value && 'border-border bg-muted text-foreground',
        )"
        @click="prefs.setTheme(th.value)"
      >
        <component :is="th.icon" class="size-4" />
        {{ t(th.key) }}
      </button>
    </div>
    <MenuLabel><Palette /> {{ t('prefs.accent') }}</MenuLabel>
    <div class="grid w-fit grid-cols-5 gap-2 px-2.5 pb-1 pt-1">
      <Tooltip v-for="s in swatches" :key="s.accent" :content="t(`prefs.accents.${s.accent}`)">
        <button
          type="button"
          :aria-label="t(`prefs.accents.${s.accent}`)"
          :aria-pressed="prefs.accent.value === s.accent"
          class="grid size-7 place-items-center rounded-full transition-transform hover:scale-110"
          :style="{
            background: `linear-gradient(135deg, ${s.soft} 45%, ${s.strong})`,
            boxShadow: prefs.accent.value === s.accent ? `0 0 0 2px rgb(var(--popover)), 0 0 0 4px ${s.strong}` : 'inset 0 0 0 1px rgba(0,0,0,0.06)',
          }"
          @click="prefs.setAccent(s.accent)"
        >
          <Check v-if="prefs.accent.value === s.accent" class="size-3.5" :style="{ color: s.strong }" :stroke-width="3" />
        </button>
      </Tooltip>
    </div>
    <div class="px-2.5 pb-2.5 text-xs text-muted-foreground">{{ t(`prefs.accents.${prefs.accent.value}`) }}</div>
    <MenuSeparator />
    <MenuLabel><Languages /> {{ t('prefs.language') }}</MenuLabel>
    <MenuItem v-for="l in (['en', 'he'] as const)" :key="l" @select="prefs.setLanguage(l)">
      <template #icon><span class="w-4 text-center text-xs">{{ l.toUpperCase() }}</span></template>
      {{ l === 'en' ? 'English' : 'עברית' }}
      <Check v-if="prefs.language.value === l" class="ms-auto inline size-4 text-primary" />
    </MenuItem>
    <slot name="footer" />
  </Menu>
</template>
