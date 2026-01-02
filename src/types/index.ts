export interface Avatar {
  id: string
  emotion: string
  imageData: string // Base64
  fileName: string
}

export interface PanelConfig {
  text: string
  emotion: string
  backgroundColor: string
  avatarId: string
}
