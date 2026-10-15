/**
 * Icons. Declarations store Material Design icon names (`mdi-airplane`, the original client's vocabulary - the
 * stored data keeps them); the rewrite draws with lucide, so a stored name is mapped to its nearest lucide
 * shape here. An unknown name falls back to the default (a building, the original `mdi-domain`).
 * Also the icon of a file by its suffix or content type (spec core-ui §4.16).
 */
import {
  Anchor, Atom, Bot, Box, Building, Building2, Bus, Car, ChartLine, Cloud, CloudSun, Cpu, Database, Droplet, Earth,
  Factory, File, FileArchive, FileAudio, FileCode, FileCog, FileImage, FileJson, FileSpreadsheet, FileText, FileType,
  FileVideo, FlaskConical, Fuel, Globe, HardHat, Hospital, Landmark, Leaf, MapPin, Microscope, Package, Plane,
  PlaneTakeoff, Radar, RadioTower, Rocket, Satellite, School, Server, ShieldCheck, Ship, ShipWheel, ShoppingCart,
  Smartphone, Sprout, Sun, Telescope, Tractor, TrainFront, Truck, Warehouse, Waves, Wind, Wrench, Zap, Construction,
  Shapes, Cylinder, Antenna, Activity, Layers, ScrollText,
} from 'lucide-vue-next'
import type { Component } from 'vue'

const MDI: Record<string, Component> = {
  'mdi-domain': Building2,
  'mdi-factory': Factory,
  'mdi-airplane': Plane,
  'mdi-airplane-takeoff': PlaneTakeoff,
  'mdi-helicopter': Plane,
  'mdi-quadcopter': Radar,
  'mdi-parachute': Wind,
  'mdi-rocket-launch': Rocket,
  'mdi-rocket': Rocket,
  'mdi-satellite-variant': Satellite,
  'mdi-satellite': Satellite,
  'mdi-radar': Radar,
  'mdi-antenna': Antenna,
  'mdi-radio-tower': RadioTower,
  'mdi-telescope': Telescope,
  'mdi-ferry': Ship,
  'mdi-ship-wheel': ShipWheel,
  'mdi-submarine': Anchor,
  'mdi-anchor': Anchor,
  'mdi-car': Car,
  'mdi-truck': Truck,
  'mdi-bus': Bus,
  'mdi-train': TrainFront,
  'mdi-tank': ShieldCheck,
  'mdi-fire-truck': Truck,
  'mdi-tractor': Tractor,
  'mdi-excavator': Construction,
  'mdi-lightning-bolt': Zap,
  'mdi-solar-power': Sun,
  'mdi-wind-turbine': Wind,
  'mdi-oil': Fuel,
  'mdi-gas-cylinder': Cylinder,
  'mdi-pipe': Waves,
  'mdi-water': Droplet,
  'mdi-leaf': Leaf,
  'mdi-sprout': Sprout,
  'mdi-hospital-building': Hospital,
  'mdi-flask': FlaskConical,
  'mdi-microscope': Microscope,
  'mdi-atom': Atom,
  'mdi-chip': Cpu,
  'mdi-server': Server,
  'mdi-cloud': Cloud,
  'mdi-cellphone': Smartphone,
  'mdi-shield-airplane': ShieldCheck,
  'mdi-bank': Landmark,
  'mdi-cart': ShoppingCart,
  'mdi-package-variant': Package,
  'mdi-warehouse': Warehouse,
  'mdi-hammer-wrench': Wrench,
  'mdi-robot-industrial': Bot,
  'mdi-account-hard-hat': HardHat,
  'mdi-earth': Earth,
  'mdi-map-marker': MapPin,
  'mdi-weather-cloudy': CloudSun,
  'mdi-school': School,
  'mdi-office-building': Building,
  'mdi-city': Building2,
  'mdi-chart-timeline-variant': ChartLine,
  'mdi-shape-outline': Shapes,
  'mdi-pulse': Activity,
  'mdi-layers': Layers,
  'mdi-text-box-outline': ScrollText,
  'mdi-cube-outline': Box,
  'mdi-globe-model': Globe,
}

export const DEFAULT_ICON = Building2

/** A stored mdi name to a lucide icon; unknown or empty → the default building. */
export function iconFor(name: string | null | undefined, fallback: Component = DEFAULT_ICON): Component {
  if (!name) return fallback
  return MDI[name.trim()] ?? fallback
}

/** The mdi names that have a drawn shape here (the IconPicker can offer them). */
export const KNOWN_ICON_NAMES = Object.keys(MDI)

const BY_SUFFIX: Record<string, Component> = {
  csv: FileSpreadsheet, tsv: FileSpreadsheet, xls: FileSpreadsheet, xlsx: FileSpreadsheet, xlsm: FileSpreadsheet,
  json: FileJson,
  yaml: FileCog, yml: FileCog, ini: FileCog, cfg: FileCog, conf: FileCog,
  xml: FileCode, html: FileCode, htm: FileCode, py: FileCode, js: FileCode, ts: FileCode,
  log: FileText, txt: FileText, md: FileText, docx: FileText, docm: FileText, dotx: FileText, doc: FileText,
  pdf: FileType,
  png: FileImage, jpg: FileImage, jpeg: FileImage, gif: FileImage, webp: FileImage, svg: FileImage, bmp: FileImage, avif: FileImage,
  mp4: FileVideo, mov: FileVideo, avi: FileVideo, mkv: FileVideo, webm: FileVideo,
  wav: FileAudio, mp3: FileAudio, ogg: FileAudio, flac: FileAudio,
  zip: FileArchive, gz: FileArchive, tar: FileArchive, bz2: FileArchive, '7z': FileArchive,
  sql: Database, bag: Database, db: Database, parquet: Database,
  bin: Box, dat: Box,
}

/** The suffix a file is known by: its recorded suffix, else the last part of its name. Lower case, no dot. */
export function suffixOf(name: string, suffix = ''): string {
  const own = suffix.replace('.', '').toLowerCase()
  if (own) return own
  const dot = name.lastIndexOf('.')
  return dot === -1 ? '' : name.slice(dot + 1).toLowerCase()
}

export function fileIcon(name: string, suffix = '', contentType = ''): Component {
  const byName = BY_SUFFIX[suffixOf(name, suffix)]
  if (byName) return byName
  const ct = contentType.toLowerCase()
  if (ct.startsWith('image/')) return FileImage
  if (ct.startsWith('video/')) return FileVideo
  if (ct.startsWith('audio/')) return FileAudio
  if (ct.startsWith('text/')) return FileText
  return File
}
