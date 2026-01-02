import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'

interface ColorPickerProps {
  value: string
  onChange: (color: string) => void
}

// Feinblick Praxis Farben - warm, therapeutisch, beruhigend
// Exakt aus dem Feinblick Design-System übernommen
const PRESET_COLORS = [
  { name: 'Warm Sand (Standard)', value: '#e8dfd0' }, // hsl(35 25% 88%) - Hauptfarbe
  { name: 'Warmer Sand', value: '#d9cdb8' }, // hsl(35 25% 78%) - Secondary
  { name: 'Soft Blush', value: '#ead9d1' }, // hsl(15 30% 85%) - Accent
  { name: 'Terracotta', value: '#c8947c' }, // hsl(12 45% 62%) - Primary
  { name: 'Sage Green', value: '#b5bfa4' }, // hsl(85 20% 65%) - Nature
  { name: 'Warm White', value: '#f0ede9' }, // hsl(35 20% 94%)
  { name: 'Soft Coral', value: '#c18674' }, // hsl(8 50% 58%)
  { name: 'Pure White', value: '#FFFFFF' }
]

export function ColorPicker({ value, onChange }: ColorPickerProps) {
  return (
    <div className="space-y-4">
      <div>
        <Label>Hintergrundfarbe</Label>
        <div className="grid grid-cols-4 gap-2 mt-2">
          {PRESET_COLORS.map((color) => (
            <button
              key={color.value}
              onClick={() => onChange(color.value)}
              className={`relative h-12 rounded-md border-2 transition-all ${
                value === color.value
                  ? 'border-primary scale-105'
                  : 'border-border hover:border-primary/50'
              }`}
              style={{ backgroundColor: color.value }}
              title={color.name}
            >
              <span className="sr-only">{color.name}</span>
              {value === color.value && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-3 h-3 bg-primary rounded-full" />
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      <div>
        <Label htmlFor="custom-color">Oder eigene Farbe wählen</Label>
        <div className="flex gap-2 mt-2">
          <Input
            id="custom-color"
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-20 h-10 cursor-pointer"
          />
          <Input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="#FFFFFF"
            className="flex-1 font-mono"
          />
        </div>
      </div>
    </div>
  )
}
