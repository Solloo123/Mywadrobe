import { WardrobeCategory } from '../types';

const COLOR_HEX_MAP: Record<string, { fill: string; stroke: string; highlight: string }> = {
  ivory: { fill: '#F7F4EB', stroke: '#D8D1C2', highlight: '#FFFFFF' },
  white: { fill: '#F9F9F8', stroke: '#DCDAD5', highlight: '#FFFFFF' },
  'off-white': { fill: '#F4F1EA', stroke: '#D5CFC2', highlight: '#FAF8F4' },
  black: { fill: '#1F1E1D', stroke: '#3D3B38', highlight: '#33312F' },
  navy: { fill: '#1D293B', stroke: '#111926', highlight: '#2B3B54' },
  charcoal: { fill: '#36383A', stroke: '#232426', highlight: '#4B4E52' },
  grey: { fill: '#8A8D91', stroke: '#686B6E', highlight: '#A3A6AA' },
  'sand beige': { fill: '#D9CBB8', stroke: '#B8A790', highlight: '#E8DEC8' },
  beige: { fill: '#D9CBB8', stroke: '#B8A790', highlight: '#E8DEC8' },
  khaki: { fill: '#C3B091', stroke: '#9E8C6E', highlight: '#D6C5A9' },
  olive: { fill: '#4E5840', stroke: '#373F2C', highlight: '#636F52' },
  'cognac brown': { fill: '#8B4B28', stroke: '#633217', highlight: '#A65E37' },
  brown: { fill: '#6B442A', stroke: '#4A2E1B', highlight: '#825537' },
  'dark brown': { fill: '#472E1E', stroke: '#2E1D12', highlight: '#5E3E2A' },
  'espresso': { fill: '#3D271D', stroke: '#261710', highlight: '#523629' },
  tan: { fill: '#B5835A', stroke: '#8F6340', highlight: '#C99870' },
  'sky blue': { fill: '#B8CFE0', stroke: '#8FAEC7', highlight: '#D0E2F0' },
  blue: { fill: '#365C85', stroke: '#244161', highlight: '#4973A1' },
  indigo: { fill: '#283757', stroke: '#1A243B', highlight: '#384B73' },
  terracotta: { fill: '#B5543A', stroke: '#8C3D27', highlight: '#CC684D' },
  burgundy: { fill: '#63222B', stroke: '#45151B', highlight: '#7D2E39' },
  emerald: { fill: '#225744', stroke: '#153B2D', highlight: '#2F7059' },
  'ochre gold': { fill: '#C8923B', stroke: '#9E7026', highlight: '#DBA651' },
  gold: { fill: '#C8A25A', stroke: '#9C7B3C', highlight: '#DEC081' },
  silver: { fill: '#C4C7CE', stroke: '#969AA3', highlight: '#DDE0E6' },
};

export function getColorSwatchHex(colorName: string): string {
  const key = (colorName || '').toLowerCase().trim();
  if (COLOR_HEX_MAP[key]) return COLOR_HEX_MAP[key].fill;
  for (const [k, v] of Object.entries(COLOR_HEX_MAP)) {
    if (key.includes(k)) return v.fill;
  }
  return '#8C7A6B';
}

function getPalette(colorName: string) {
  const key = (colorName || '').toLowerCase().trim();
  if (COLOR_HEX_MAP[key]) return COLOR_HEX_MAP[key];
  for (const [k, v] of Object.entries(COLOR_HEX_MAP)) {
    if (key.includes(k)) return v;
  }
  return { fill: '#8C7A6B', stroke: '#66574B', highlight: '#A39081' };
}

export function getGarmentStudioSvgDataUrl(params: {
  category: WardrobeCategory;
  subcategory: string;
  primaryColor: string;
  secondaryColor?: string;
  pattern?: string;
  name?: string;
}): string {
  const primary = getPalette(params.primaryColor);
  const secondary =
    params.secondaryColor && params.secondaryColor.toLowerCase() !== 'none'
      ? getPalette(params.secondaryColor)
      : { fill: primary.stroke, stroke: primary.stroke, highlight: primary.highlight };

  const sub = (params.subcategory || '').toLowerCase();
  const pat = (params.pattern || '').toLowerCase();

  let patternDefs = '';
  let fillAttr = `fill="${primary.fill}"`;

  if (pat.includes('strip')) {
    patternDefs = `
      <pattern id="pat" width="16" height="16" patternUnits="userSpaceOnUse" patternTransform="rotate(90)">
        <rect width="16" height="16" fill="${primary.fill}" />
        <rect width="3" height="16" fill="${secondary.fill}" opacity="0.45" />
      </pattern>
    `;
    fillAttr = 'fill="url(#pat)"';
  } else if (pat.includes('kitenge') || pat.includes('geometric') || pat.includes('dashiki')) {
    patternDefs = `
      <pattern id="pat" width="36" height="36" patternUnits="userSpaceOnUse">
        <rect width="36" height="36" fill="${primary.fill}" />
        <polygon points="18,3 33,18 18,33 3,18" fill="none" stroke="${secondary.fill}" stroke-width="2.5" opacity="0.7" />
        <circle cx="18" cy="18" r="5" fill="#C8923B" opacity="0.65" />
      </pattern>
    `;
    fillAttr = 'fill="url(#pat)"';
  } else if (pat.includes('check') || pat.includes('plaid')) {
    patternDefs = `
      <pattern id="pat" width="24" height="24" patternUnits="userSpaceOnUse">
        <rect width="24" height="24" fill="${primary.fill}" />
        <path d="M 24 0 L 0 0 0 24" fill="none" stroke="${secondary.fill}" stroke-width="2" opacity="0.4" />
      </pattern>
    `;
    fillAttr = 'fill="url(#pat)"';
  }

  let silhouette = '';

  if (sub.includes('kanzu')) {
    silhouette = `
      <!-- Long East African Kanzu Robe -->
      <path d="M150 95 L195 78 L245 78 L290 95 L335 190 L298 205 L276 142 L284 415 L156 415 L164 142 L142 205 L105 190 Z" ${fillAttr} stroke="${primary.stroke}" stroke-width="3" stroke-linejoin="round"/>
      <!-- Embroidered Placket & Collar -->
      <path d="M195 78 Q220 94 245 78" fill="none" stroke="#C89D66" stroke-width="4"/>
      <rect x="213" y="88" width="14" height="92" rx="4" fill="none" stroke="#C89D66" stroke-width="2.5"/>
      <line x1="220" y1="88" x2="220" y2="176" stroke="#C89D66" stroke-width="1.5"/>
    `;
  } else if (sub.includes('jacket') || sub.includes('coat') || sub.includes('blazer')) {
    silhouette = `
      <!-- Tailored Jacket / Blazer -->
      <path d="M142 96 L188 78 L252 78 L298 96 L338 258 L298 268 L274 152 L280 376 L224 376 L220 245 L216 376 L160 376 L166 152 L142 268 L102 258 Z" ${fillAttr} stroke="${primary.stroke}" stroke-width="3" stroke-linejoin="round"/>
      <!-- Lapels -->
      <path d="M188 78 L220 225 L168 158 Z" fill="${primary.highlight}" stroke="${primary.stroke}" stroke-width="2"/>
      <path d="M252 78 L220 225 L272 158 Z" fill="${primary.highlight}" stroke="${primary.stroke}" stroke-width="2"/>
      <circle cx="220" cy="246" r="4.5" fill="${ primary.stroke }"/>
      <circle cx="220" cy="282" r="4.5" fill="${ primary.stroke }"/>
    `;
  } else if (
    sub.includes('shirt') ||
    sub.includes('kitenge') ||
    sub.includes('dashiki') ||
    sub.includes('polo')
  ) {
    const isShortSleeve = sub.includes('polo') || sub.includes('kitenge') || sub.includes('dashiki');
    silhouette = isShortSleeve
      ? `
      <!-- Short-Sleeve Shirt / Polo / Kitenge -->
      <path d="M148 100 L190 82 L250 82 L292 100 L332 184 L288 204 L270 156 L274 364 L166 364 L170 156 L152 204 L108 184 Z" ${fillAttr} stroke="${primary.stroke}" stroke-width="3" stroke-linejoin="round"/>
      <path d="M190 82 L220 116 L250 82 L238 72 L202 72 Z" fill="${primary.highlight}" stroke="${primary.stroke}" stroke-width="2.5"/>
      <line x1="220" y1="116" x2="220" y2="364" stroke="${primary.stroke}" stroke-width="2" opacity="0.6"/>
      `
      : `
      <!-- Long-Sleeve Button Shirt -->
      <path d="M146 98 L190 80 L250 80 L294 98 L338 282 L300 292 L272 158 L276 368 L164 368 L168 158 L140 292 L102 282 Z" ${fillAttr} stroke="${primary.stroke}" stroke-width="3" stroke-linejoin="round"/>
      <path d="M190 80 L220 114 L250 80 L238 70 L202 70 Z" fill="${primary.highlight}" stroke="${primary.stroke}" stroke-width="2.5"/>
      <line x1="220" y1="114" x2="220" y2="368" stroke="${primary.stroke}" stroke-width="2" opacity="0.6"/>
      <circle cx="220" cy="150" r="3" fill="${primary.stroke}"/>
      <circle cx="220" cy="195" r="3" fill="${primary.stroke}"/>
      <circle cx="220" cy="240" r="3" fill="${primary.stroke}"/>
      `;
  } else if (sub.includes('t-shirt') || sub.includes('sweater') || sub.includes('hoodie')) {
    const isLong = sub.includes('sweater') || sub.includes('hoodie');
    silhouette = isLong
      ? `
      <path d="M148 100 L192 84 Q220 98 248 84 L292 100 L336 276 L298 286 L272 160 L274 360 L166 360 L168 160 L142 286 L104 276 Z" ${fillAttr} stroke="${primary.stroke}" stroke-width="3" stroke-linejoin="round"/>
      <path d="M192 84 Q220 108 248 84" fill="none" stroke="${primary.stroke}" stroke-width="4"/>
      `
      : `
      <path d="M146 104 L192 86 Q220 102 248 86 L294 104 L334 182 L290 202 L270 156 L272 358 L168 358 L170 156 L150 202 L106 182 Z" ${fillAttr} stroke="${primary.stroke}" stroke-width="3" stroke-linejoin="round"/>
      <path d="M192 86 Q220 108 248 86" fill="none" stroke="${primary.stroke}" stroke-width="4"/>
      `;
  } else if (params.category === 'Bottoms') {
    const isShorts = sub.includes('short');
    silhouette = isShorts
      ? `
      <path d="M156 98 L284 98 L298 274 L232 274 L220 185 L208 274 L142 274 Z" ${fillAttr} stroke="${primary.stroke}" stroke-width="3" stroke-linejoin="round"/>
      <line x1="156" y1="118" x2="284" y2="118" stroke="${primary.stroke}" stroke-width="2.5"/>
      <line x1="220" y1="118" x2="220" y2="178" stroke="${primary.stroke}" stroke-width="2"/>
      `
      : `
      <!-- Tailored Trousers / Chinos / Jeans -->
      <path d="M162 78 L278 78 L292 396 L238 396 L220 176 L202 396 L148 396 Z" ${fillAttr} stroke="${primary.stroke}" stroke-width="3" stroke-linejoin="round"/>
      <line x1="162" y1="100" x2="278" y2="100" stroke="${primary.stroke}" stroke-width="2.5"/>
      <line x1="220" y1="100" x2="220" y2="165" stroke="${primary.stroke}" stroke-width="2"/>
      <line x1="184" y1="120" x2="176" y2="386" stroke="${primary.stroke}" stroke-width="1" opacity="0.35"/>
      <line x1="256" y1="120" x2="264" y2="386" stroke="${primary.stroke}" stroke-width="1" opacity="0.35"/>
      `;
  } else if (params.category === 'Footwear') {
    silhouette = `
      <!-- Studio Footwear Profile -->
      <g transform="translate(0, 20)">
        <path d="M106 258 C106 225 124 192 148 184 L196 188 C222 208 258 222 308 228 C334 232 346 246 346 266 L106 266 Z" ${fillAttr} stroke="${primary.stroke}" stroke-width="3" stroke-linejoin="round"/>
        <rect x="102" y="266" width="248" height="16" rx="5" fill="${secondary.fill}" stroke="${primary.stroke}" stroke-width="2.5"/>
        <path d="M196 188 L234 214" stroke="${primary.stroke}" stroke-width="3" stroke-linecap="round"/>
        <line x1="204" y1="196" x2="216" y2="188" stroke="${primary.highlight}" stroke-width="2.5" stroke-linecap="round"/>
        <line x1="216" y1="204" x2="228" y2="196" stroke="${primary.highlight}" stroke-width="2.5" stroke-linecap="round"/>
      </g>
    `;
  } else if (sub.includes('watch')) {
    silhouette = `
      <!-- Luxury Wristwatch -->
      <rect x="198" y="84" width="44" height="288" rx="10" fill="${secondary.fill}" stroke="${primary.stroke}" stroke-width="3"/>
      <circle cx="220" cy="228" r="56" fill="${primary.fill}" stroke="#C89D66" stroke-width="6"/>
      <circle cx="220" cy="228" r="44" fill="#FAF8F5" stroke="${primary.stroke}" stroke-width="1.5"/>
      <line x1="220" y1="228" x2="220" y2="198" stroke="#181615" stroke-width="3" stroke-linecap="round"/>
      <line x1="220" y1="228" x2="244" y2="228" stroke="#8C5A32" stroke-width="2.5" stroke-linecap="round"/>
      <circle cx="220" cy="228" r="4" fill="#C89D66"/>
    `;
  } else if (sub.includes('belt')) {
    silhouette = `
      <!-- Coiled Leather Dress Belt -->
      <ellipse cx="220" cy="236" rx="105" ry="58" fill="none" stroke="${primary.fill}" stroke-width="26"/>
      <ellipse cx="220" cy="236" rx="105" ry="58" fill="none" stroke="${primary.stroke}" stroke-width="2"/>
      <rect x="104" y="214" width="42" height="44" rx="8" fill="none" stroke="#C89D66" stroke-width="7"/>
      <line x1="104" y1="236" x2="128" y2="236" stroke="#C89D66" stroke-width="5" stroke-linecap="round"/>
    `;
  } else if (sub.includes('sunglass')) {
    silhouette = `
      <!-- Acetate Sunglasses -->
      <rect x="104" y="198" width="98" height="68" rx="22" ${fillAttr} stroke="#C89D66" stroke-width="5"/>
      <rect x="238" y="198" width="98" height="68" rx="22" ${fillAttr} stroke="#C89D66" stroke-width="5"/>
      <path d="M202 218 Q220 206 238 218" fill="none" stroke="#C89D66" stroke-width="5" stroke-linecap="round"/>
    `;
  } else if (sub.includes('tie')) {
    silhouette = `
      <!-- Silk Necktie -->
      <polygon points="198,92 242,92 232,130 208,130" ${fillAttr} stroke="${primary.stroke}" stroke-width="3"/>
      <polygon points="208,130 232,130 248,342 220,378 192,342" ${fillAttr} stroke="${primary.stroke}" stroke-width="3"/>
    `;
  } else {
    silhouette = `
      <!-- Structured Accessory / Bag / Hat -->
      <rect x="136" y="156" width="168" height="152" rx="20" ${fillAttr} stroke="${primary.stroke}" stroke-width="3"/>
      <path d="M180 156 C180 112 260 112 260 156" fill="none" stroke="${primary.stroke}" stroke-width="6" stroke-linecap="round"/>
    `;
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 440 480" width="440" height="480">
    <defs>
      <radialGradient id="studioBg" cx="50%" cy="42%" r="65%">
        <stop offset="0%" stop-color="#FAF7F2"/>
        <stop offset="100%" stop-color="#EAE3D7"/>
      </radialGradient>
      <filter id="softShadow" x="-15%" y="-10%" width="130%" height="130%">
        <feDropShadow dx="0" dy="14" stdDeviation="12" flood-color="#181615" flood-opacity="0.12"/>
      </filter>
      ${patternDefs}
    </defs>
    <rect width="440" height="480" fill="url(#studioBg)"/>
    <!-- Travertine Studio Pedestal Line -->
    <ellipse cx="220" cy="422" rx="124" ry="14" fill="#DED5C6" opacity="0.65"/>
    <g filter="url(#softShadow)">
      ${silhouette}
    </g>
  </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

// Compress user-uploaded image on client canvas so it fits comfortably in Firestore (<200KB) and sends fast to Gemini
export async function compressImageFile(
  file: File,
  maxDimension = 850,
  quality = 0.78
): Promise<{ dataUrl: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Invalid image format'));
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve({ dataUrl: String(reader.result), mimeType: file.type || 'image/jpeg' });
          return;
        }
        ctx.fillStyle = '#FAF8F5';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        const compressed = canvas.toDataURL('image/jpeg', quality);
        resolve({ dataUrl: compressed, mimeType: 'image/jpeg' });
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}
