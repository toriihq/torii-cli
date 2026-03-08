import * as fs from 'node:fs'
import * as path from 'node:path'
import * as crypto from 'node:crypto'
import * as os from 'node:os'

const TTL_MS = 24 * 60 * 60 * 1000 // 24 hours
const DEFAULT_CACHE_DIR = path.join(os.homedir(), '.torii-cli', 'cache')

export class SpecCache {
  private dir: string

  constructor(dir: string = DEFAULT_CACHE_DIR) {
    this.dir = dir
  }

  getFilePath(url: string): string {
    const hash = crypto.createHash('sha256').update(url).digest('hex').slice(0, 12)
    return path.join(this.dir, `spec-${hash}.json`)
  }

  get(url: string): unknown | null {
    const filePath = this.getFilePath(url)
    if (!fs.existsSync(filePath)) return null

    const stat = fs.statSync(filePath)
    if (Date.now() - stat.mtimeMs > TTL_MS) return null

    return JSON.parse(fs.readFileSync(filePath, 'utf-8'))
  }

  getStale(url: string): unknown | null {
    const filePath = this.getFilePath(url)
    if (!fs.existsSync(filePath)) return null
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'))
  }

  set(url: string, spec: unknown): void {
    fs.mkdirSync(this.dir, { recursive: true })
    fs.writeFileSync(this.getFilePath(url), JSON.stringify(spec))
  }

  clear(): void {
    if (!fs.existsSync(this.dir)) return
    for (const file of fs.readdirSync(this.dir)) {
      if (file.startsWith('spec-') && file.endsWith('.json')) {
        fs.unlinkSync(path.join(this.dir, file))
      }
    }
  }
}
