export class WebglAddon {
  activate = jest.fn()
  dispose = jest.fn()
  onContextLoss = jest.fn()
  readonly textureAtlas: unknown = null
}
