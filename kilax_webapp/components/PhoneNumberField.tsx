'use client'

import { useMemo } from 'react'

export type PhoneCountry = readonly [code: string, name: string, dialCode: string]

// ISO/E.164 country calling-code catalog. The selected calling code is always
// included in the value submitted to Supabase (E.164-style: +countrycode...).
const COUNTRIES: PhoneCountry[] = [
  ['UG','Uganda','256'],['KE','Kenya','254'],['TZ','Tanzania','255'],['RW','Rwanda','250'],['BI','Burundi','257'],['SS','South Sudan','211'],['CD','DR Congo','243'],['CG','Republic of the Congo','242'],['ET','Ethiopia','251'],['SO','Somalia','252'],['DJ','Djibouti','253'],['ER','Eritrea','291'],['SD','Sudan','249'],['ZA','South Africa','27'],['NG','Nigeria','234'],['GH','Ghana','233'],['CI','Côte d’Ivoire','225'],['SN','Senegal','221'],['SL','Sierra Leone','232'],['LR','Liberia','231'],['GM','Gambia','220'],['GN','Guinea','224'],['GW','Guinea-Bissau','245'],['CV','Cape Verde','238'],['MR','Mauritania','222'],['ML','Mali','223'],['BF','Burkina Faso','226'],['NE','Niger','227'],['TD','Chad','235'],['CM','Cameroon','237'],['CF','Central African Republic','236'],['GQ','Equatorial Guinea','240'],['GA','Gabon','241'],['ST','São Tomé and Príncipe','239'],['AO','Angola','244'],['NA','Namibia','264'],['BW','Botswana','267'],['ZM','Zambia','260'],['ZW','Zimbabwe','263'],['MZ','Mozambique','258'],['MW','Malawi','265'],['MG','Madagascar','261'],['MU','Mauritius','230'],['SC','Seychelles','248'],['KM','Comoros','269'],['LS','Lesotho','266'],['SZ','Eswatini','268'],
  ['US','United States','1'],['CA','Canada','1'],['MX','Mexico','52'],['GT','Guatemala','502'],['BZ','Belize','501'],['SV','El Salvador','503'],['HN','Honduras','504'],['NI','Nicaragua','505'],['CR','Costa Rica','506'],['PA','Panama','507'],['CU','Cuba','53'],['JM','Jamaica','1876'],['HT','Haiti','509'],['DO','Dominican Republic','1809'],['PR','Puerto Rico','1787'],['TT','Trinidad and Tobago','1868'],['BB','Barbados','1246'],['BS','Bahamas','1242'],['AG','Antigua and Barbuda','1268'],['DM','Dominica','1767'],['GD','Grenada','1473'],['KN','Saint Kitts and Nevis','1869'],['LC','Saint Lucia','1758'],['VC','Saint Vincent and the Grenadines','1784'],['GY','Guyana','592'],['SR','Suriname','597'],['BR','Brazil','55'],['AR','Argentina','54'],['CL','Chile','56'],['CO','Colombia','57'],['PE','Peru','51'],['EC','Ecuador','593'],['BO','Bolivia','591'],['PY','Paraguay','595'],['UY','Uruguay','598'],['VE','Venezuela','58'],
  ['GB','United Kingdom','44'],['IE','Ireland','353'],['FR','France','33'],['DE','Germany','49'],['ES','Spain','34'],['PT','Portugal','351'],['IT','Italy','39'],['NL','Netherlands','31'],['BE','Belgium','32'],['LU','Luxembourg','352'],['CH','Switzerland','41'],['AT','Austria','43'],['DK','Denmark','45'],['SE','Sweden','46'],['NO','Norway','47'],['FI','Finland','358'],['IS','Iceland','354'],['PL','Poland','48'],['CZ','Czechia','420'],['SK','Slovakia','421'],['HU','Hungary','36'],['RO','Romania','40'],['BG','Bulgaria','359'],['GR','Greece','30'],['CY','Cyprus','357'],['MT','Malta','356'],['SI','Slovenia','386'],['HR','Croatia','385'],['BA','Bosnia and Herzegovina','387'],['RS','Serbia','381'],['ME','Montenegro','382'],['MK','North Macedonia','389'],['AL','Albania','355'],['XK','Kosovo','383'],['EE','Estonia','372'],['LV','Latvia','371'],['LT','Lithuania','370'],['BY','Belarus','375'],['UA','Ukraine','380'],['MD','Moldova','373'],['RU','Russia','7'],['GE','Georgia','995'],['AM','Armenia','374'],['AZ','Azerbaijan','994'],['TR','Türkiye','90'],
  ['IL','Israel','972'],['PS','Palestine','970'],['JO','Jordan','962'],['LB','Lebanon','961'],['SY','Syria','963'],['IQ','Iraq','964'],['IR','Iran','98'],['SA','Saudi Arabia','966'],['AE','United Arab Emirates','971'],['QA','Qatar','974'],['KW','Kuwait','965'],['BH','Bahrain','973'],['OM','Oman','968'],['YE','Yemen','967'],['EG','Egypt','20'],['LY','Libya','218'],['TN','Tunisia','216'],['DZ','Algeria','213'],['MA','Morocco','212'],
  ['IN','India','91'],['PK','Pakistan','92'],['BD','Bangladesh','880'],['LK','Sri Lanka','94'],['NP','Nepal','977'],['BT','Bhutan','975'],['MV','Maldives','960'],['AF','Afghanistan','93'],['KZ','Kazakhstan','7'],['UZ','Uzbekistan','998'],['TM','Turkmenistan','993'],['TJ','Tajikistan','992'],['KG','Kyrgyzstan','996'],
  ['CN','China','86'],['HK','Hong Kong','852'],['MO','Macao','853'],['JP','Japan','81'],['KR','South Korea','82'],['TW','Taiwan','886'],['MN','Mongolia','976'],['VN','Vietnam','84'],['TH','Thailand','66'],['KH','Cambodia','855'],['LA','Laos','856'],['MM','Myanmar','95'],['MY','Malaysia','60'],['SG','Singapore','65'],['ID','Indonesia','62'],['PH','Philippines','63'],['BN','Brunei','673'],['TL','Timor-Leste','670'],
  ['AU','Australia','61'],['NZ','New Zealand','64'],['FJ','Fiji','679'],['PG','Papua New Guinea','675'],['SB','Solomon Islands','677'],['VU','Vanuatu','678'],['NC','New Caledonia','687'],['WS','Samoa','685'],['TO','Tonga','676'],['TV','Tuvalu','688'],['KI','Kiribati','686'],['FM','Micronesia','691'],['MH','Marshall Islands','692'],['PW','Palau','680'],['NR','Nauru','674'],
]

export const PHONE_COUNTRIES = COUNTRIES.map(([code, name, dialCode]) => ({ code, name, dialCode }))

export function normalizeInternationalPhone(dialCode: string, nationalNumber: string): string {
  return `+${dialCode}${nationalNumber.replace(/\D/g, '')}`
}

export function isValidInternationalPhone(dialCode: string, nationalNumber: string): boolean {
  const digits = nationalNumber.replace(/\D/g, '')
  if (!dialCode || digits.length < 6) return false
  const totalDigits = dialCode.replace(/\D/g, '').length + digits.length
  // E.164 permits a maximum of 15 digits. The 7-digit minimum below also
  // prevents obviously incomplete entries while the country code is mandatory.
  return totalDigits >= 7 && totalDigits <= 15
}

interface PhoneNumberFieldProps {
  countryCode: string
  phone: string
  onCountryChange: (countryCode: string) => void
  onPhoneChange: (phone: string) => void
  disabled?: boolean
  error?: string
}

export function PhoneNumberField({ countryCode, phone, onCountryChange, onPhoneChange, disabled, error }: PhoneNumberFieldProps) {
  const country = useMemo(() => PHONE_COUNTRIES.find(c => c.code === countryCode) || PHONE_COUNTRIES[0], [countryCode])
  const dialCode = country.dialCode

  return (
    <div>
      <div className={`flex overflow-hidden rounded-lg border ${error ? 'border-red-500' : 'border-gray-700'} bg-[#22283a] focus-within:ring-2 focus-within:ring-orange-500`}>
        <select
          aria-label="Country code"
          value={country.code}
          onChange={e => onCountryChange(e.target.value)}
          disabled={disabled}
          className="w-[145px] shrink-0 bg-[#1b2030] px-3 py-3 text-sm text-white outline-none border-r border-gray-700"
        >
          {PHONE_COUNTRIES.map(c => (
            <option key={c.code} value={c.code}>+{c.dialCode} · {c.name}</option>
          ))}
        </select>
        <input
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          value={phone}
          onChange={e => onPhoneChange(e.target.value.replace(/[^0-9 ()-]/g, ''))}
          placeholder="Phone number"
          disabled={disabled}
          className="min-w-0 flex-1 bg-transparent px-4 py-3 text-white placeholder-gray-400 outline-none"
        />
      </div>
      <p className="mt-1 text-xs text-gray-500">Country code is required. Saved as +{dialCode}…</p>
      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
    </div>
  )
}
