export const ICON_SPECS = [
  { key: 'appleTouchIcon', size: 180 },
  { key: 'manifestIcon192', size: 192 },
  { key: 'manifestIcon512', size: 512 },
];

export function resolveIconSpec(key) {
  const spec = ICON_SPECS.find((entry) => entry.key === key);
  if (!spec) {
    throw new Error(`Unknown icon spec: ${key}`);
  }
  return spec;
}

export function computeContainLayout(sourceWidth, sourceHeight, canvasSize, paddingRatio = 0.12) {
  const safeSize = canvasSize * (1 - 2 * paddingRatio);
  const scale = Math.min(safeSize / sourceWidth, safeSize / sourceHeight);
  const drawWidth = sourceWidth * scale;
  const drawHeight = sourceHeight * scale;
  return {
    drawWidth,
    drawHeight,
    dx: (canvasSize - drawWidth) / 2,
    dy: (canvasSize - drawHeight) / 2,
  };
}

function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('Failed to decode image file'));
      image.src = reader.result;
    };
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.readAsDataURL(file);
  });
}

function loadImageFromUrl(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Failed to load image from ${url}`));
    image.src = url;
  });
}

export function loadImageElement(input) {
  if (typeof input === 'string') {
    return loadImageFromUrl(input);
  }
  return loadImageFromFile(input);
}

export function renderIconCanvas(image, size, paddingRatio = 0.12) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const sourceWidth = image.naturalWidth || image.width;
  const sourceHeight = image.naturalHeight || image.height;
  const { drawWidth, drawHeight, dx, dy } = computeContainLayout(sourceWidth, sourceHeight, size, paddingRatio);
  ctx.clearRect(0, 0, size, size);
  ctx.drawImage(image, dx, dy, drawWidth, drawHeight);
  return canvas;
}

export function canvasToPngDataUrl(canvas) {
  return canvas.toDataURL('image/png');
}

export async function normalizeIconSet(input, { paddingRatio = 0.12 } = {}) {
  const image = await loadImageElement(input);
  const result = {};
  for (const spec of ICON_SPECS) {
    const canvas = renderIconCanvas(image, spec.size, paddingRatio);
    result[spec.key] = canvasToPngDataUrl(canvas);
  }
  return result;
}
