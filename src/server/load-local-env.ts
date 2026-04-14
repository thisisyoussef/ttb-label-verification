import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

const LOCAL_ENV_FILENAMES = ['.env', '.env.local'] as const
const dotenvLinePattern =
  /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)?$/

function parseQuotedValue(value: string) {
  const unwrapped = value.slice(1, -1)

  if (value.startsWith("'")) {
    return unwrapped
  }

  return unwrapped
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, '\\')
}

function stripInlineComment(value: string) {
  for (let index = 0; index < value.length; index += 1) {
    if (value[index] === '#' && index > 0 && /\s/.test(value[index - 1])) {
      return value.slice(0, index).trimEnd()
    }
  }

  return value
}

function normalizeValue(rawValue: string) {
  const trimmed = rawValue.trim()

  if (!trimmed) {
    return ''
  }

  const isSingleQuoted =
    trimmed.startsWith("'") && trimmed.endsWith("'") && trimmed.length >= 2
  const isDoubleQuoted =
    trimmed.startsWith('"') && trimmed.endsWith('"') && trimmed.length >= 2

  if (isSingleQuoted || isDoubleQuoted) {
    return parseQuotedValue(trimmed)
  }

  return stripInlineComment(trimmed)
}

export function parseDotEnvContents(contents: string) {
  const values: Record<string, string> = {}

  for (const line of contents.split(/\r?\n/)) {
    const trimmedLine = line.trim()
    if (!trimmedLine || trimmedLine.startsWith('#')) {
      continue
    }

    const match = line.match(dotenvLinePattern)
    if (!match) {
      continue
    }

    const [, key, rawValue = ''] = match
    values[key] = normalizeValue(rawValue)
  }

  return values
}

export function parseDotEnvFile(filePath: string) {
  if (!existsSync(filePath)) {
    return {}
  }

  try {
    return parseDotEnvContents(readFileSync(filePath, 'utf8'))
  } catch {
    return {}
  }
}

export function loadLocalEnv(cwd = process.cwd()) {
  const inheritedEnvKeys = new Set(Object.keys(process.env))
  const loadedFiles: string[] = []

  for (const filename of LOCAL_ENV_FILENAMES) {
    const filePath = path.join(cwd, filename)
    if (!existsSync(filePath)) {
      continue
    }

    const parsed = parseDotEnvFile(filePath)
    for (const [key, value] of Object.entries(parsed)) {
      if (inheritedEnvKeys.has(key)) {
        continue
      }

      process.env[key] = value
    }

    loadedFiles.push(filePath)
  }

  return loadedFiles
}
