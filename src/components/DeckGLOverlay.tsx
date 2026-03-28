import { useControl } from 'react-map-gl/maplibre'
import { MapboxOverlay } from '@deck.gl/mapbox'
import type { Layer } from 'deck.gl'

export function DeckGLOverlay({ layers }: { layers: Layer[] }) {
  const overlay = useControl(() => new MapboxOverlay({ interleaved: false }))
  overlay.setProps({ layers })
  return null
}
