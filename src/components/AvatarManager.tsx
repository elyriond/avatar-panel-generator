import { useState, useRef, useEffect } from 'react'
import { Upload, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import type { Avatar } from '@/types'
import {
  getAvatars,
  addAvatar,
  deleteAvatar,
  fileToBase64,
  validateImageFile
} from '@/lib/avatar-storage'

export function AvatarManager() {
  const [avatars, setAvatars] = useState<Avatar[]>([])
  const [dragActive, setDragActive] = useState(false)
  const [newEmotion, setNewEmotion] = useState('')
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Avatare beim Mount laden
  useEffect(() => {
    setAvatars(getAvatars())
  }, [])

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true)
    } else if (e.type === "dragleave") {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFiles(e.dataTransfer.files)
    }
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFiles(e.target.files)
    }
  }

  const handleFiles = async (files: FileList) => {
    const file = files[0]

    // Validierung
    const validation = validateImageFile(file)
    if (!validation.valid) {
      alert(validation.error)
      return
    }

    // Emotion prüfen
    if (!newEmotion.trim()) {
      alert('Bitte gib eine Emotion an (z.B. "fröhlich", "nachdenklich")')
      return
    }

    setUploading(true)

    try {
      const imageData = await fileToBase64(file)
      const newAvatar: Avatar = {
        id: crypto.randomUUID(),
        emotion: newEmotion.trim(),
        imageData,
        fileName: file.name
      }

      addAvatar(newAvatar)
      setAvatars(getAvatars())
      setNewEmotion('')

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    } catch (error) {
      console.error('Fehler beim Upload:', error)
      alert('Fehler beim Hochladen des Avatars')
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = (id: string) => {
    if (confirm('Möchtest du diesen Avatar wirklich löschen?')) {
      deleteAvatar(id)
      setAvatars(getAvatars())
    }
  }

  return (
    <div className="space-y-6">
      {/* Upload Area */}
      <div className="space-y-4">
        <div>
          <Label htmlFor="emotion">Emotion für neuen Avatar</Label>
          <Input
            id="emotion"
            type="text"
            placeholder="z.B. fröhlich, nachdenklich, neutral"
            value={newEmotion}
            onChange={(e) => setNewEmotion(e.target.value)}
            className="mt-2"
          />
        </div>

        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            dragActive
              ? 'border-primary bg-primary/5'
              : 'border-muted-foreground/25 hover:border-primary/50'
          }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileInput}
            className="hidden"
          />

          <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />

          <p className="text-sm text-muted-foreground mb-4">
            Ziehe ein Bild hierher oder
          </p>

          <Button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading || !newEmotion.trim()}
            variant="outline"
          >
            {uploading ? 'Hochladen...' : 'Datei auswählen'}
          </Button>

          <p className="text-xs text-muted-foreground mt-4">
            PNG, JPG, WEBP oder GIF (max. 5MB)
          </p>
        </div>
      </div>

      {/* Avatar-Liste */}
      {avatars.length > 0 && (
        <div>
          <h3 className="text-sm font-medium mb-3">
            Deine Avatare ({avatars.length})
          </h3>
          <div className="grid grid-cols-2 gap-4">
            {avatars.map((avatar) => (
              <Card key={avatar.id} className="relative group">
                <div className="p-4">
                  <img
                    src={avatar.imageData}
                    alt={avatar.emotion}
                    className="w-full aspect-square object-contain rounded-md mb-2 bg-muted"
                  />
                  <p className="text-sm font-medium capitalize">
                    {avatar.emotion}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {avatar.fileName}
                  </p>
                </div>

                <Button
                  size="icon"
                  variant="destructive"
                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => handleDelete(avatar.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </Card>
            ))}
          </div>
        </div>
      )}

      {avatars.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">
          Noch keine Avatare hochgeladen. Füge deinen ersten Avatar hinzu!
        </p>
      )}
    </div>
  )
}
