#!/usr/bin/env node
import fs from 'fs/promises'
import path from 'path'

function parseArgs(argv) {
  const args = {}
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i]
    if (a.startsWith('--')) {
      const [k, v] = a.split('=')
      const key = k.replace(/^--/, '')
      if (v !== undefined) {
        args[key] = v
      } else if (i + 1 < argv.length && !argv[i + 1].startsWith('--')) {
        args[key] = argv[i + 1]
        i++
      } else {
        args[key] = true
      }
    } else {
      const key = !args.original ? 'original' : !args.translated ? 'translated' : 'extra'
      if (key !== 'extra') args[key] = a
    }
  }
  return args
}

function usage() {
  console.log('Usage: node scripts/validate-json.mjs --original <path> --translated <path> [--seps="|"]')
}

function isObject(x) {
  return x && typeof x === 'object' && !Array.isArray(x)
}

function flatten(json, prefix = '') {
  const out = {}
  if (Array.isArray(json)) {
    for (let i = 0; i < json.length; i++) {
      const p = prefix ? `${prefix}[${i}]` : `[${i}]`
      const v = json[i]
      if (isObject(v) || Array.isArray(v)) Object.assign(out, flatten(v, p))
      else out[p] = v
    }
  } else if (isObject(json)) {
    for (const k of Object.keys(json)) {
      const p = prefix ? `${prefix}.${k}` : k
      const v = json[k]
      if (isObject(v) || Array.isArray(v)) Object.assign(out, flatten(v, p))
      else out[p] = v
    }
  } else {
    out[prefix || '$'] = json
  }
  return out
}

function removeChinese(str) {
  return String(str).replace(/[\p{Script=Han}]/gu, '')
}

function buildSepRegex(seps) {
  const parts = seps.map(s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const union = parts.join('|')
  return new RegExp(`\\s*(?:${union})\\s*`, 'gu')
}

function normalizeTranslated(str, sepRegex) {
  const noZh = removeChinese(str)
  const noSep = noZh.replace(sepRegex, '')
  return noSep.trim()
}

async function readJson(p) {
  const data = await fs.readFile(p, 'utf8')
  return JSON.parse(data)
}

function compare(originalFlat, translatedFlat, sepRegex) {
  const errors = []
  const warnings = []
  for (const key of Object.keys(originalFlat)) {
    if (!(key in translatedFlat)) {
      errors.push({ type: 'missing', path: key })
      continue
    }
    const ov = originalFlat[key]
    const tv = translatedFlat[key]
    if (typeof ov !== typeof tv) {
      errors.push({ type: 'type_mismatch', path: key, expectedType: typeof ov, actualType: typeof tv })
      continue
    }
    if (typeof ov === 'string') {
      const nt = normalizeTranslated(tv, sepRegex)
      if (nt !== ov) {
        errors.push({ type: 'string_mismatch', path: key, expected: ov, actual: nt })
      }
    } else {
      if (JSON.stringify(tv) !== JSON.stringify(ov)) {
        errors.push({ type: 'value_mismatch', path: key, expected: ov, actual: tv })
      }
    }
  }
  for (const key of Object.keys(translatedFlat)) {
    if (!(key in originalFlat)) warnings.push({ type: 'extra', path: key })
  }
  return { errors, warnings }
}

async function main() {
  const args = parseArgs(process.argv)
  if (!args.original || !args.translated) {
    usage()
    process.exitCode = 2
    return
  }
  const sepArg = args.seps ? String(args.seps) : '|' 
  const seps = sepArg.split(',').map(s => s.trim()).filter(Boolean)
  if (!seps.includes('｜')) seps.push('｜')
  const sepRegex = buildSepRegex(seps)
  const origPath = path.resolve(process.cwd(), args.original)
  const transPath = path.resolve(process.cwd(), args.translated)
  let original
  let translated
  try {
    original = await readJson(origPath)
    translated = await readJson(transPath)
  } catch (e) {
    console.error('Read/Parse error:', e.message)
    process.exitCode = 2
    return
  }
  const originalFlat = flatten(original)
  const translatedFlat = flatten(translated)
  const { errors, warnings } = compare(originalFlat, translatedFlat, sepRegex)
  if (warnings.length) {
    for (const w of warnings) {
      console.log(`Warning: extra path ${w.path}`)
    }
  }
  if (errors.length) {
    for (const e of errors) {
      if (e.type === 'missing') console.log(`Error: missing path ${e.path}`)
      else if (e.type === 'type_mismatch') console.log(`Error: type mismatch at ${e.path}, expected ${e.expectedType}, got ${e.actualType}`)
      else if (e.type === 'string_mismatch') console.log(`Error: string mismatch at ${e.path}, expected "${e.expected}", got "${e.actual}"`)
      else if (e.type === 'value_mismatch') console.log(`Error: value mismatch at ${e.path}, expected ${JSON.stringify(e.expected)}, got ${JSON.stringify(e.actual)}`)
    }
    console.log(`Validation failed: ${errors.length} error(s), ${warnings.length} warning(s).`)
    process.exitCode = 1
  } else {
    console.log(`Validation passed with ${warnings.length} warning(s).`)
    process.exitCode = 0
  }
}

main()
