const CODES =
  'AR BO BR CL CO CR CU DO EC SV GT HN MX NI PA PY PE PR UY VE US CA ES PT FR IT DE GB IE NL BE CH AT SE NO DK FI IS PL CZ SK HU RO BG GR TR RU UA BY RS HR SI BA ME MK AL XK MD LT LV EE GE AM AZ KZ UZ KG TJ TM IL PS LB SY JO IQ IR SA AE QA KW BH OM YE EG MA DZ TN LY SD ET KE TZ UG RW NG GH CI SN CM AO MZ ZA ZW ZM BW NA MG IN PK BD LK NP AF CN JP KR KP MN TW HK TH VN KH LA MM MY SG ID PH AU NZ FJ JM HT TT BS BB BZ GY SR'.split(
    ' ',
  )

const names = new Intl.DisplayNames(['es'], { type: 'region' })

export function countryName(code: string | null) {
  if (!code) return ''
  try {
    return names.of(code.toUpperCase()) ?? code
  } catch {
    return code
  }
}

export const COUNTRIES = CODES.map((code) => ({ code, name: countryName(code) })).sort((a, b) =>
  a.name.localeCompare(b.name, 'es'),
)

export function isCountry(code: string) {
  return CODES.includes(code.toUpperCase())
}

export function findCountry(raw: string) {
  const v = raw.trim()
  if (!v) return null
  if (v.length === 2 && isCountry(v)) return v.toUpperCase()
  const lower = v.toLowerCase()
  return COUNTRIES.find((c) => c.name.toLowerCase() === lower)?.code ?? null
}
