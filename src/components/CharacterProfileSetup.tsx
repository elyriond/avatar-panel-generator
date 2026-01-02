import { useState } from 'react'
import { Upload, Check, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  type CharacterProfile,
  createCharacterProfile,
  updateReferenceImages,
  updateStylePreferences,
  updateBrandVoice,
  saveCharacterProfile,
  getReferenceImageCount,
  isProfileComplete
} from '@/lib/character-profile'
import { validateImageFile } from '@/lib/avatar-storage'
import { compressImage } from '@/lib/image-compression'

interface CharacterProfileSetupProps {
  existingProfile?: CharacterProfile
  onComplete: (profile: CharacterProfile) => void
}

type SetupStep = 'name' | 'images' | 'style' | 'brand' | 'complete'

const REFERENCE_IMAGE_TYPES = [
  { key: 'frontal', label: 'Frontal-Ansicht', description: 'Avatar von vorne' },
  { key: 'profileLeft', label: 'Profil Links', description: 'Avatar von der linken Seite' },
  { key: 'profileRight', label: 'Profil Rechts', description: 'Avatar von der rechten Seite' },
  { key: 'threeQuarter', label: 'Drei-Viertel-Ansicht', description: 'Avatar leicht gedreht' },
  { key: 'fullBody', label: 'Ganzkörper', description: 'Volle Figur sichtbar' }
] as const

export function CharacterProfileSetup({ existingProfile, onComplete }: CharacterProfileSetupProps) {
  const [profile, setProfile] = useState<CharacterProfile>(
    existingProfile || createCharacterProfile('Feinblick')
  )
  const [currentStep, setCurrentStep] = useState<SetupStep>(
    existingProfile ? 'complete' : 'name'
  )
  const [uploadingImage, setUploadingImage] = useState<string | null>(null)

  // Form States
  const [name, setName] = useState(profile.name)
  const [visualStyle, setVisualStyle] = useState(profile.stylePreferences.visualStyle)
  const [atmosphere, setAtmosphere] = useState(profile.stylePreferences.atmosphere)
  const [writingStyle, setWritingStyle] = useState(profile.brandVoice.writingStyle)
  const [coreThemes, setCoreThemes] = useState(profile.brandVoice.coreThemes.join(', '))
  const [targetAudience, setTargetAudience] = useState(profile.brandVoice.targetAudience)

  const handleImageUpload = async (key: keyof typeof profile.referenceImages, file: File) => {
    const validation = validateImageFile(file)
    if (!validation.valid) {
      alert(validation.error)
      return
    }

    setUploadingImage(key)

    try {
      // Komprimiere das Bild vor dem Speichern
      const compressedImageData = await compressImage(file, {
        maxWidth: 800,
        maxHeight: 800,
        quality: 0.8
      })

      const updatedProfile = updateReferenceImages(profile, { [key]: compressedImageData })
      setProfile(updatedProfile)
      saveCharacterProfile(updatedProfile)
    } catch (error) {
      console.error('Fehler beim Hochladen:', error)
      alert('Fehler beim Hochladen des Bildes. Möglicherweise ist es zu groß.')
    } finally {
      setUploadingImage(null)
    }
  }

  const handleNameSubmit = () => {
    if (!name.trim()) {
      alert('Bitte gib einen Namen ein')
      return
    }

    const updatedProfile = { ...profile, name: name.trim() }
    setProfile(updatedProfile)
    saveCharacterProfile(updatedProfile)
    setCurrentStep('images')
  }

  const handleImagesSubmit = () => {
    const imageCount = getReferenceImageCount(profile)
    if (imageCount < 3) {
      alert('Bitte lade mindestens 3 Referenzbilder hoch')
      return
    }

    setCurrentStep('style')
  }

  const handleStyleSubmit = () => {
    if (!visualStyle.trim() || !atmosphere.trim()) {
      alert('Bitte fülle alle Felder aus')
      return
    }

    const updatedProfile = updateStylePreferences(profile, {
      visualStyle: visualStyle.trim(),
      atmosphere: atmosphere.trim(),
      colorPalette: ['#e8dfd0', '#d9cdb8', '#ead9d1'] // Feinblick Standard
    })
    setProfile(updatedProfile)
    saveCharacterProfile(updatedProfile)
    setCurrentStep('brand')
  }

  const handleBrandSubmit = () => {
    if (!writingStyle.trim() || !coreThemes.trim() || !targetAudience.trim()) {
      alert('Bitte fülle alle Felder aus')
      return
    }

    const updatedProfile = updateBrandVoice(profile, {
      writingStyle: writingStyle.trim(),
      coreThemes: coreThemes.split(',').map(t => t.trim()).filter(t => t),
      targetAudience: targetAudience.trim()
    })
    setProfile(updatedProfile)
    saveCharacterProfile(updatedProfile)
    setCurrentStep('complete')
  }

  const handleComplete = () => {
    if (!isProfileComplete(profile)) {
      alert('Profil ist noch nicht vollständig')
      return
    }

    onComplete(profile)
  }

  // Step: Name
  if (currentStep === 'name') {
    return (
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>Willkommen! Lass uns dein Character Profile erstellen</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="name">Wie soll dein Character heißen?</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="z.B. Feinblick, [Dein Name], etc."
              className="mt-2"
            />
            <p className="text-sm text-muted-foreground mt-2">
              Das ist der Name, den die KI für deinen Avatar-Charakter verwendet.
            </p>
          </div>

          <Button onClick={handleNameSubmit} className="w-full" size="lg">
            Weiter <ArrowRight className="ml-2 w-4 h-4" />
          </Button>
        </CardContent>
      </Card>
    )
  }

  // Step: Reference Images
  if (currentStep === 'images') {
    const imageCount = getReferenceImageCount(profile)

    return (
      <Card className="max-w-4xl mx-auto">
        <CardHeader>
          <CardTitle>Referenzbilder hochladen ({imageCount}/5)</CardTitle>
          <p className="text-sm text-muted-foreground">
            Lade mindestens 3, besser 5 verschiedene Ansichten deines Avatars hoch.
            So kann die KI ihn in verschiedenen Posen zeichnen.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {REFERENCE_IMAGE_TYPES.map(({ key, label, description }) => {
              const imageData = profile.referenceImages[key]
              const isUploading = uploadingImage === key

              return (
                <div key={key} className="space-y-2">
                  <Label>{label}</Label>
                  <div className="relative border-2 border-dashed rounded-lg p-4 min-h-[200px] flex flex-col items-center justify-center">
                    {imageData ? (
                      <>
                        <img
                          src={imageData}
                          alt={label}
                          className="w-full h-40 object-contain rounded"
                        />
                        <Check className="absolute top-2 right-2 w-5 h-5 text-green-500" />
                      </>
                    ) : (
                      <>
                        <Upload className="w-8 h-8 text-muted-foreground mb-2" />
                        <p className="text-xs text-muted-foreground text-center mb-2">
                          {description}
                        </p>
                      </>
                    )}

                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) handleImageUpload(key, file)
                      }}
                      disabled={isUploading}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                    />

                    {isUploading && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-lg">
                        <p className="text-white text-sm">Hochladen...</p>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          <div className="flex gap-4">
            <Button
              onClick={() => setCurrentStep('name')}
              variant="outline"
              className="flex-1"
            >
              Zurück
            </Button>
            <Button
              onClick={handleImagesSubmit}
              disabled={imageCount < 3}
              className="flex-1"
              size="lg"
            >
              Weiter ({imageCount}/5) <ArrowRight className="ml-2 w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Step: Visual Style
  if (currentStep === 'style') {
    return (
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>Visueller Stil</CardTitle>
          <p className="text-sm text-muted-foreground">
            Beschreibe, wie deine Comics aussehen sollen.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="visualStyle">Visual Style</Label>
            <Input
              id="visualStyle"
              value={visualStyle}
              onChange={(e) => setVisualStyle(e.target.value)}
              placeholder="z.B. minimalistisch, comic-realistisch, warm"
              className="mt-2"
            />
            <p className="text-sm text-muted-foreground mt-1">
              Wie sollen die Bilder stilistisch aussehen?
            </p>
          </div>

          <div>
            <Label htmlFor="atmosphere">Atmosphäre</Label>
            <Input
              id="atmosphere"
              value={atmosphere}
              onChange={(e) => setAtmosphere(e.target.value)}
              placeholder="z.B. therapeutisch, beruhigend, warm"
              className="mt-2"
            />
            <p className="text-sm text-muted-foreground mt-1">
              Welches Gefühl sollen die Bilder vermitteln?
            </p>
          </div>

          <div className="flex gap-4">
            <Button
              onClick={() => setCurrentStep('images')}
              variant="outline"
              className="flex-1"
            >
              Zurück
            </Button>
            <Button onClick={handleStyleSubmit} className="flex-1" size="lg">
              Weiter <ArrowRight className="ml-2 w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Step: Brand Voice
  if (currentStep === 'brand') {
    return (
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>Brand Voice & Inhalte</CardTitle>
          <p className="text-sm text-muted-foreground">
            Definiere deinen Schreibstil und deine Kernthemen.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="writingStyle">Schreibstil</Label>
            <Input
              id="writingStyle"
              value={writingStyle}
              onChange={(e) => setWritingStyle(e.target.value)}
              placeholder="z.B. warm, professionell, nahbar"
              className="mt-2"
            />
            <p className="text-sm text-muted-foreground mt-1">
              Wie möchtest du schreiben?
            </p>
          </div>

          <div>
            <Label htmlFor="coreThemes">Kernthemen (komma-getrennt)</Label>
            <Textarea
              id="coreThemes"
              value={coreThemes}
              onChange={(e) => setCoreThemes(e.target.value)}
              placeholder="z.B. Hochsensibilität, Beziehungen, Nervensystem"
              rows={3}
              className="mt-2"
            />
            <p className="text-sm text-muted-foreground mt-1">
              Worüber schreibst du hauptsächlich?
            </p>
          </div>

          <div>
            <Label htmlFor="targetAudience">Zielgruppe</Label>
            <Input
              id="targetAudience"
              value={targetAudience}
              onChange={(e) => setTargetAudience(e.target.value)}
              placeholder="z.B. Hochsensible Menschen, Therapie-Interessierte"
              className="mt-2"
            />
            <p className="text-sm text-muted-foreground mt-1">
              Wen sprichst du an?
            </p>
          </div>

          <div className="flex gap-4">
            <Button
              onClick={() => setCurrentStep('style')}
              variant="outline"
              className="flex-1"
            >
              Zurück
            </Button>
            <Button onClick={handleBrandSubmit} className="flex-1" size="lg">
              Fertig <Check className="ml-2 w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Step: Complete
  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Check className="w-6 h-6 text-green-500" />
          Perfekt! Dein Character Profile ist fertig
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Die KI kennt jetzt deinen Stil und wird dir helfen, konsistente Comics zu erstellen.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Name:</span>
            <span className="font-medium">{profile.name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Referenzbilder:</span>
            <span className="font-medium">{getReferenceImageCount(profile)}/5</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Visual Style:</span>
            <span className="font-medium">{profile.stylePreferences.visualStyle}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Schreibstil:</span>
            <span className="font-medium">{profile.brandVoice.writingStyle}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Themen:</span>
            <span className="font-medium">{profile.brandVoice.coreThemes.join(', ')}</span>
          </div>
        </div>

        <Button onClick={handleComplete} className="w-full" size="lg">
          Los geht's! <ArrowRight className="ml-2 w-4 h-4" />
        </Button>

        <Button
          onClick={() => setCurrentStep('name')}
          variant="outline"
          className="w-full"
        >
          Profil bearbeiten
        </Button>
      </CardContent>
    </Card>
  )
}
