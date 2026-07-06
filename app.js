const canvas = document.querySelector('#mosaicCanvas')
const ctx = canvas.getContext('2d')

const imageInput = document.querySelector('#imageInput')
const fileStatus = document.querySelector('#fileStatus')
const emptyState = document.querySelector('#emptyState')
const shuffleButton = document.querySelector('#shuffleButton')
const exportButton = document.querySelector('#exportButton')
const generateButton = document.querySelector('#generateButton')
const ratioOptions = document.querySelector('#ratioOptions')
const zoomRange = document.querySelector('#zoomRange')
const zoomValue = document.querySelector('#zoomValue')
const resetImageButton = document.querySelector('#resetImageButton')
const fitImageButton = document.querySelector('#fitImageButton')
const imageAdjustTool = document.querySelector('#imageAdjustTool')
const tileEditTool = document.querySelector('#tileEditTool')
const gridSelect = document.querySelector('#gridSelect')
const gapRange = document.querySelector('#gapRange')
const gapValue = document.querySelector('#gapValue')
const strengthRange = document.querySelector('#strengthRange')
const strengthValue = document.querySelector('#strengthValue')
const backgroundColorInput = document.querySelector('#backgroundColor')
const blockColorInput = document.querySelector('#blockColor')
const selectedTileText = document.querySelector('#selectedTileText')
const tilePopover = document.querySelector('#tilePopover')
const colorTileButton = document.querySelector('#colorTileButton')
const restoreTileButton = document.querySelector('#restoreTileButton')
const randomTileButton = document.querySelector('#randomTileButton')
const clearSelectionButton = document.querySelector('#clearSelectionButton')
const palette = document.querySelector('#palette')
const filterOptions = document.querySelector('#filterOptions')
const gridStats = document.querySelector('#gridStats')
const tileStats = document.querySelector('#tileStats')
const footerHint = document.querySelector('#footerHint')
const filterCanvas = document.createElement('canvas')
const filterCtx = filterCanvas.getContext('2d', { willReadFrequently: true })

const DEFAULT_COLORS = ['#f5f5f7', '#ffffff', '#0066ff', '#1d1d1f', '#d2d2d7', '#ff5733']
const BLANK_MOSAIC_COLORS = ['#ffffff', '#f7f4ed', '#eee9dd', '#f1f1ee', '#d9d9d4']
const BLANK_BACKGROUND_COLOR = '#f8f7f3'
const BLANK_GRID_LINE_COLOR = '#d8d8d3'
const DEFAULT_DOPAMINE_COLORS = ['#ff6f61', '#ffb84d', '#f7e66b', '#6bd68a', '#60c7e8', '#9b8cff', '#f08ac7']
const COLORFUL_COLOR_COUNT = 5
const EXPORT_LONG_SIDE = 1200
const TOOL_MODES = {
  IMAGE_ADJUST: 'image-adjust',
  TILE_EDIT: 'tile-edit',
}
const FILTERS = {
  NONE: 'none',
  GRAYSCALE: 'grayscale',
  WARM: 'warm',
  COOL: 'cool',
  FADE: 'fade',
  CONTRAST: 'contrast',
  GRAIN: 'grain',
  SCANLINE: 'scanline',
}
const FILTER_LABELS = {
  [FILTERS.NONE]: '原图',
  [FILTERS.GRAYSCALE]: '黑白',
  [FILTERS.WARM]: '暖调',
  [FILTERS.COOL]: '冷调',
  [FILTERS.FADE]: '褪色',
  [FILTERS.CONTRAST]: '高对比',
  [FILTERS.GRAIN]: '胶片颗粒',
  [FILTERS.SCANLINE]: '扫描线',
}

const ASPECT_RATIOS = [
  { id: 'original', label: '原图', ratio: null },
  { id: '1-1', label: '1:1', ratio: 1 },
  { id: '3-4', label: '3:4', ratio: 3 / 4 },
  { id: '4-5', label: '4:5', ratio: 4 / 5 },
  { id: '9-16', label: '9:16', ratio: 9 / 16 },
  { id: '16-9', label: '16:9', ratio: 16 / 9 },
]

const state = {
  image: null,
  crop: null,
  tiles: [],
  selectedTileId: null,
  mode: 'border',
  aspectRatioId: '3-4',
  aspectRatio: 3 / 4,
  imageTransform: {
    scale: 1,
    offsetX: 0,
    offsetY: 0,
  },
  toolMode: TOOL_MODES.TILE_EDIT,
  isDraggingImage: false,
  dragDepth: 0,
  dragStart: null,
  gridCols: 9,
  gridRows: 12,
  gap: 3,
  shuffleStrength: 0.18,
  backgroundColor: '#f5f5f7',
  blockColor: '#0066ff',
  imageRecommendedColor: '#f5f5f7',
  imageColorProfile: {
    saturation: 0.45,
    lightness: 0.72,
    palette: DEFAULT_DOPAMINE_COLORS,
  },
}

function setUploadDragActive(isActive) {
  document.body.classList.toggle('is-dragging-upload', isActive)
}

function toHex(value) {
  return Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, '0')
}

function rgbToHex(r, g, b) {
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

function clampChannel(value) {
  return Math.max(0, Math.min(255, Math.round(value)))
}

function rgbToHsl(r, g, b) {
  const red = r / 255
  const green = g / 255
  const blue = b / 255
  const max = Math.max(red, green, blue)
  const min = Math.min(red, green, blue)
  let h = 0
  let s = 0
  const l = (max + min) / 2

  if (max !== min) {
    const delta = max - min
    s = l > 0.5 ? delta / (2 - max - min) : delta / (max + min)

    if (max === red) {
      h = (green - blue) / delta + (green < blue ? 6 : 0)
    } else if (max === green) {
      h = (blue - red) / delta + 2
    } else {
      h = (red - green) / delta + 4
    }

    h /= 6
  }

  return { h: h * 360, s, l }
}

function hslToHex(h, s, l) {
  const hue = (((h % 360) + 360) % 360) / 360

  if (s === 0) {
    const value = l * 255
    return rgbToHex(value, value, value)
  }

  const hueToRgb = (p, q, t) => {
    let nextT = t
    if (nextT < 0) nextT += 1
    if (nextT > 1) nextT -= 1
    if (nextT < 1 / 6) return p + (q - p) * 6 * nextT
    if (nextT < 1 / 2) return q
    if (nextT < 2 / 3) return p + (q - p) * (2 / 3 - nextT) * 6
    return p
  }

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q

  return rgbToHex(
    hueToRgb(p, q, hue + 1 / 3) * 255,
    hueToRgb(p, q, hue) * 255,
    hueToRgb(p, q, hue - 1 / 3) * 255
  )
}

function softenColor({ r, g, b }) {
  // Blend toward white so the recommended color works as a quiet border/background.
  return rgbToHex(r * 0.72 + 255 * 0.28, g * 0.72 + 255 * 0.28, b * 0.72 + 255 * 0.28)
}

function getRecommendedColor(image, crop) {
  const sampleCanvas = document.createElement('canvas')
  const sampleSize = 36
  sampleCanvas.width = sampleSize
  sampleCanvas.height = sampleSize

  const sampleCtx = sampleCanvas.getContext('2d')
  sampleCtx.drawImage(image, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, sampleSize, sampleSize)

  const pixels = sampleCtx.getImageData(0, 0, sampleSize, sampleSize).data
  let r = 0
  let g = 0
  let b = 0
  let count = 0

  for (let index = 0; index < pixels.length; index += 4) {
    const red = pixels[index]
    const green = pixels[index + 1]
    const blue = pixels[index + 2]
    const alpha = pixels[index + 3]
    const brightness = (red + green + blue) / 3

    if (alpha < 200 || brightness < 18 || brightness > 244) continue

    r += red
    g += green
    b += blue
    count += 1
  }

  if (!count) return '#f5f5f7'

  return softenColor({
    r: r / count,
    g: g / count,
    b: b / count,
  })
}

function getImageColorProfile(image, crop) {
  const sampleCanvas = document.createElement('canvas')
  const sampleSize = 40
  sampleCanvas.width = sampleSize
  sampleCanvas.height = sampleSize

  const sampleCtx = sampleCanvas.getContext('2d')
  sampleCtx.drawImage(image, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, sampleSize, sampleSize)

  const pixels = sampleCtx.getImageData(0, 0, sampleSize, sampleSize).data
  const hues = []
  let saturation = 0
  let lightness = 0
  let count = 0

  for (let index = 0; index < pixels.length; index += 4) {
    const red = pixels[index]
    const green = pixels[index + 1]
    const blue = pixels[index + 2]
    const alpha = pixels[index + 3]
    const brightness = (red + green + blue) / 3

    if (alpha < 200 || brightness < 18 || brightness > 244) continue

    const hsl = rgbToHsl(red, green, blue)
    saturation += hsl.s
    lightness += hsl.l
    count += 1

    if (hsl.s > 0.12) {
      hues.push(hsl.h)
    }
  }

  if (!count) {
    return {
      saturation: 0.45,
      lightness: 0.72,
      palette: DEFAULT_DOPAMINE_COLORS,
    }
  }

  const avgSaturation = saturation / count
  const avgLightness = lightness / count
  const baseHue = hues.length ? hues[Math.floor(hues.length / 2)] : 210
  const targetSaturation = Math.max(0.38, Math.min(0.92, avgSaturation * 1.35 + 0.18))
  const targetLightness = Math.max(0.52, Math.min(0.78, avgLightness * 0.72 + 0.22))
  const hueOffsets = [-54, -24, 0, 28, 58, 118]
  const palette = hueOffsets.map((offset, index) =>
    hslToHex(
      baseHue + offset,
      Math.max(0.34, Math.min(0.95, targetSaturation - (index % 2) * 0.08)),
      Math.max(0.5, Math.min(0.8, targetLightness + (index % 3) * 0.035))
    )
  )

  return {
    saturation: avgSaturation,
    lightness: avgLightness,
    palette,
  }
}

function getDopaminePalette() {
  const palette = state.imageColorProfile.palette?.length
    ? state.imageColorProfile.palette
    : DEFAULT_DOPAMINE_COLORS

  return palette.slice(0, COLORFUL_COLOR_COUNT)
}

function getSoftPalette() {
  const baseHsl = rgbToHsl(
    Number.parseInt(state.imageRecommendedColor.slice(1, 3), 16),
    Number.parseInt(state.imageRecommendedColor.slice(3, 5), 16),
    Number.parseInt(state.imageRecommendedColor.slice(5, 7), 16)
  )

  return [
    state.imageRecommendedColor,
    hslToHex(baseHsl.h - 24, Math.max(0.18, baseHsl.s * 0.75), Math.min(0.88, baseHsl.l + 0.08)),
    hslToHex(baseHsl.h + 24, Math.max(0.18, baseHsl.s * 0.85), Math.min(0.84, baseHsl.l + 0.04)),
    '#ffffff',
    '#f5f5f7',
  ]
}

function getPaletteColorsForMode() {
  if (state.mode === 'blank') {
    return [BLANK_BACKGROUND_COLOR, ...BLANK_MOSAIC_COLORS]
  }

  if (state.mode === 'colorful') {
    return getDopaminePalette()
  }

  return getSoftPalette()
}

function applyRecommendedColors(color) {
  state.imageRecommendedColor = color
  state.backgroundColor = color
  state.blockColor = color
  backgroundColorInput.value = color
  blockColorInput.value = color
}

function applyBlankMosaicColors() {
  state.backgroundColor = BLANK_BACKGROUND_COLOR
  state.blockColor = '#eee9dd'
  backgroundColorInput.value = state.backgroundColor
  blockColorInput.value = state.blockColor
}

function applyModeColorDefaults() {
  if (state.mode === 'blank') {
    applyBlankMosaicColors()
  } else if (state.mode === 'colorful') {
    state.backgroundColor = state.imageRecommendedColor
    state.blockColor = getDopaminePalette()[0]
    backgroundColorInput.value = state.backgroundColor
    blockColorInput.value = state.blockColor
  } else {
    state.backgroundColor = state.imageRecommendedColor
    state.blockColor = state.imageRecommendedColor
    backgroundColorInput.value = state.backgroundColor
    blockColorInput.value = state.blockColor
  }

  renderPalette()
}

function getAspectRatioById(id) {
  return ASPECT_RATIOS.find((ratio) => ratio.id === id) || ASPECT_RATIOS[2]
}

function getBestAspectRatioPreset(imageWidth, imageHeight) {
  const imageRatio = imageWidth / imageHeight
  const threshold = 0.1
  const candidates = ASPECT_RATIOS.filter((preset) => preset.ratio)
  const best = candidates.reduce((currentBest, preset) => {
    const currentDiff = Math.abs(currentBest.ratio - imageRatio)
    const nextDiff = Math.abs(preset.ratio - imageRatio)
    return nextDiff < currentDiff ? preset : currentBest
  }, candidates[0])

  return Math.abs(best.ratio - imageRatio) <= threshold ? best : ASPECT_RATIOS[0]
}

function setAspectRatio(id) {
  const preset = getAspectRatioById(id)
  state.aspectRatioId = preset.id
  state.aspectRatio = preset.ratio || (state.image ? state.image.width / state.image.height : 3 / 4)
  resizeCanvasForAspectRatio()
  updateRatioControls()
  updateCropFromTransform()

  if (state.image) {
    generateMosaic()
  } else {
    drawBackground()
  }
}

function resizeCanvasForAspectRatio() {
  const ratio = state.aspectRatio || 3 / 4

  if (ratio >= 1) {
    canvas.width = EXPORT_LONG_SIDE
    canvas.height = Math.round(EXPORT_LONG_SIDE / ratio)
  } else {
    canvas.height = EXPORT_LONG_SIDE
    canvas.width = Math.round(EXPORT_LONG_SIDE * ratio)
  }
}

function updateCropFromTransform() {
  if (!state.image) return

  const baseCrop = getCenterCropRect(state.image.width, state.image.height, state.aspectRatio)
  const scale = Math.max(1, state.imageTransform.scale)
  const sw = baseCrop.sw / scale
  const sh = baseCrop.sh / scale
  const sx = baseCrop.sx + (baseCrop.sw - sw) / 2 + state.imageTransform.offsetX
  const sy = baseCrop.sy + (baseCrop.sh - sh) / 2 + state.imageTransform.offsetY

  state.crop = {
    sx: Math.max(0, Math.min(state.image.width - sw, sx)),
    sy: Math.max(0, Math.min(state.image.height - sh, sy)),
    sw,
    sh,
  }
}

function resetImageTransform() {
  state.imageTransform = {
    scale: 1,
    offsetX: 0,
    offsetY: 0,
  }
  zoomRange.value = '100'
  updateZoomLabel()
  updateCropFromTransform()
  draw()
}

function updateZoomLabel() {
  zoomValue.textContent = `${Math.round(state.imageTransform.scale * 100)}%`
}

function updateImageZoom(value) {
  const baseCrop = state.image
    ? getCenterCropRect(state.image.width, state.image.height, state.aspectRatio)
    : null
  const currentCenter = state.crop
    ? {
        x: state.crop.sx + state.crop.sw / 2,
        y: state.crop.sy + state.crop.sh / 2,
      }
    : null

  state.imageTransform.scale = Number(value) / 100

  if (baseCrop && currentCenter) {
    state.imageTransform.offsetX = currentCenter.x - (baseCrop.sx + baseCrop.sw / 2)
    state.imageTransform.offsetY = currentCenter.y - (baseCrop.sy + baseCrop.sh / 2)
  }

  updateZoomLabel()
  updateCropFromTransform()
  draw()
}

function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const image = new Image()

    image.onload = () => {
      URL.revokeObjectURL(url)
      resolve(image)
    }

    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('图片加载失败'))
    }

    image.src = url
  })
}

function getCenterCropRect(imageWidth, imageHeight, targetRatio) {
  const imageRatio = imageWidth / imageHeight

  if (imageRatio > targetRatio) {
    const sw = imageHeight * targetRatio
    return {
      sx: (imageWidth - sw) / 2,
      sy: 0,
      sw,
      sh: imageHeight,
    }
  }

  const sh = imageWidth / targetRatio
  return {
    sx: 0,
    sy: (imageHeight - sh) / 2,
    sw: imageWidth,
    sh,
  }
}

function calculateGridRows() {
  const borderPadding = getBorderPadding()
  const drawableWidth = canvas.width - borderPadding * 2
  const drawableHeight = canvas.height - borderPadding * 2
  state.gridRows = Math.max(1, Math.round(state.gridCols * (drawableHeight / drawableWidth)))
  updateStats()
}

function getBorderPadding() {
  return state.mode === 'border' ? Math.round(canvas.width * 0.1) : 0
}

function createTiles() {
  const tiles = []

  for (let row = 0; row < state.gridRows; row += 1) {
    for (let col = 0; col < state.gridCols; col += 1) {
      tiles.push({
        id: `${row}-${col}`,
        row,
        col,
        sourceRow: row,
        sourceCol: col,
        type: 'image',
        color: null,
        filterId: FILTERS.NONE,
      })
    }
  }

  return tiles
}

function cloneTiles(tiles) {
  return tiles.map((tile) => ({ ...tile }))
}

function shuffleArray(items) {
  for (let index = items.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    ;[items[index], items[swapIndex]] = [items[swapIndex], items[index]]
  }

  return items
}

function distanceFromCenter(tile) {
  const centerRow = (state.gridRows - 1) / 2
  const centerCol = (state.gridCols - 1) / 2
  return Math.hypot(tile.row - centerRow, tile.col - centerCol)
}

function pickRandomTiles(tiles, count, protectCenter = false) {
  const candidates = tiles.filter((tile) => {
    if (!protectCenter) return true

    const maxDistance = Math.hypot(state.gridRows / 2, state.gridCols / 2)
    const normalizedDistance = distanceFromCenter(tile) / maxDistance
    const keepChance = normalizedDistance < 0.32 ? 0.72 : 0.08

    return Math.random() > keepChance
  })

  return shuffleArray([...candidates]).slice(0, Math.max(0, count))
}

function swapTileContent(a, b) {
  const snapshot = {
    sourceRow: a.sourceRow,
    sourceCol: a.sourceCol,
    type: a.type,
    color: a.color,
    filterId: a.filterId,
  }

  a.sourceRow = b.sourceRow
  a.sourceCol = b.sourceCol
  a.type = b.type
  a.color = b.color
  a.filterId = b.filterId || FILTERS.NONE

  b.sourceRow = snapshot.sourceRow
  b.sourceCol = snapshot.sourceCol
  b.type = snapshot.type
  b.color = snapshot.color
  b.filterId = snapshot.filterId || FILTERS.NONE
}

function applyLightShuffle(tiles) {
  const nextTiles = cloneTiles(tiles)
  const count = Math.floor(nextTiles.length * state.shuffleStrength)
  const candidates = pickRandomTiles(nextTiles, count, true)

  for (let index = 0; index < candidates.length - 1; index += 2) {
    swapTileContent(candidates[index], candidates[index + 1])
  }

  return nextTiles
}

function applyRemixShuffle(tiles) {
  const nextTiles = cloneTiles(tiles)
  const count = Math.floor(nextTiles.length * state.shuffleStrength)
  const candidates = pickRandomTiles(nextTiles, count, true)
  const sources = candidates.map((tile) => ({
    sourceRow: tile.sourceRow,
    sourceCol: tile.sourceCol,
    type: tile.type,
    color: tile.color,
    filterId: tile.filterId,
  }))

  shuffleArray(sources)

  candidates.forEach((tile, index) => {
    tile.sourceRow = sources[index].sourceRow
    tile.sourceCol = sources[index].sourceCol
    tile.type = sources[index].type
    tile.color = sources[index].color
    tile.filterId = sources[index].filterId || FILTERS.NONE
  })

  return nextTiles
}

function applyBlankMosaic(tiles) {
  const nextTiles = cloneTiles(tiles)
  const maxDistance = Math.hypot(state.gridRows / 2, state.gridCols / 2)
  const fillColor = BLANK_MOSAIC_COLORS[Math.floor(Math.random() * BLANK_MOSAIC_COLORS.length)]
  const blankRatio = Math.max(0.35, Math.min(0.92, 0.38 + state.shuffleStrength * 0.68))
  const blankCount = Math.round(nextTiles.length * blankRatio)
  state.blockColor = fillColor
  blockColorInput.value = fillColor

  const candidates = shuffleArray(
    [...nextTiles].sort((a, b) => distanceFromCenter(b) - distanceFromCenter(a))
  )
  const blankTiles = candidates.slice(0, blankCount)

  blankTiles.forEach((tile) => {
    const normalizedDistance = distanceFromCenter(tile) / maxDistance
    const protectCenter = normalizedDistance < 0.32 && Math.random() < 0.78

    if (!protectCenter) {
      tile.type = 'color'
      tile.color = fillColor
      tile.filterId = FILTERS.NONE
    }
  })

  return nextTiles
}

function applyColorfulMosaic(tiles) {
  const shuffledTiles = applyLightShuffle(tiles)
  const nextTiles = cloneTiles(shuffledTiles)
  const colorPalette = getDopaminePalette()
  const colors = colorPalette.flatMap((color) => {
    const repeatCount = Math.random() < 0.45 ? 1 : 2
    return Array.from({ length: repeatCount }, () => color)
  })
  const count = colors.length
  const candidates = pickRandomTiles(nextTiles, count, false)

  candidates.forEach((tile, index) => {
    tile.type = 'color'
    tile.color = colors[index % colors.length]
  })

  return nextTiles
}

function applyColorBlocks(tiles) {
  const nextTiles = cloneTiles(tiles)
  if (state.mode !== 'border') return nextTiles

  const count = 3
  const candidates = pickRandomTiles(nextTiles, count, true)

  candidates.forEach((tile) => {
    tile.type = 'color'
    tile.color = state.blockColor
  })

  return nextTiles
}

function generateMosaic() {
  if (!state.image) return

  updateCropFromTransform()
  calculateGridRows()
  const originalTiles = createTiles()

  if (state.mode === 'border') {
    state.tiles = applyColorBlocks(applyLightShuffle(originalTiles))
  } else if (state.mode === 'blank') {
    state.tiles = applyBlankMosaic(originalTiles)
  } else if (state.mode === 'colorful') {
    state.tiles = applyColorfulMosaic(originalTiles)
  } else {
    state.tiles = applyRemixShuffle(originalTiles)
  }

  state.selectedTileId = null
  updateSelectedTileUi()
  draw()
}

function getTileMetrics() {
  const borderPadding = getBorderPadding()
  const availableWidth = canvas.width - borderPadding * 2 - state.gap * (state.gridCols - 1)
  const availableHeight = canvas.height - borderPadding * 2 - state.gap * (state.gridRows - 1)
  const tileWidth = availableWidth / state.gridCols
  const tileHeight = availableHeight / state.gridRows
  const tileSize = Math.min(tileWidth, tileHeight)
  const gridWidth = tileSize * state.gridCols + state.gap * (state.gridCols - 1)
  const gridHeight = tileSize * state.gridRows + state.gap * (state.gridRows - 1)

  return {
    tileSize,
    offsetX: (canvas.width - gridWidth) / 2,
    offsetY: (canvas.height - gridHeight) / 2,
  }
}

function getGridSourceCrop() {
  const targetRatio = state.gridCols / state.gridRows
  const cropRatio = state.crop.sw / state.crop.sh

  if (cropRatio > targetRatio) {
    const sw = state.crop.sh * targetRatio
    return {
      sx: state.crop.sx + (state.crop.sw - sw) / 2,
      sy: state.crop.sy,
      sw,
      sh: state.crop.sh,
    }
  }

  const sh = state.crop.sw / targetRatio
  return {
    sx: state.crop.sx,
    sy: state.crop.sy + (state.crop.sh - sh) / 2,
    sw: state.crop.sw,
    sh,
  }
}

function drawBackground() {
  ctx.fillStyle = state.backgroundColor
  ctx.fillRect(0, 0, canvas.width, canvas.height)
}

function applyPixelFilter(imageData, filterId) {
  if (filterId === FILTERS.NONE || filterId === FILTERS.GRAIN || filterId === FILTERS.SCANLINE) {
    return imageData
  }

  const pixels = imageData.data

  for (let index = 0; index < pixels.length; index += 4) {
    const red = pixels[index]
    const green = pixels[index + 1]
    const blue = pixels[index + 2]
    const luminance = red * 0.299 + green * 0.587 + blue * 0.114

    if (filterId === FILTERS.GRAYSCALE) {
      pixels[index] = luminance
      pixels[index + 1] = luminance
      pixels[index + 2] = luminance
    } else if (filterId === FILTERS.WARM) {
      pixels[index] = clampChannel(red * 1.08 + 8)
      pixels[index + 1] = clampChannel(green * 1.03 + 3)
      pixels[index + 2] = clampChannel(blue * 0.9)
    } else if (filterId === FILTERS.COOL) {
      pixels[index] = clampChannel(red * 0.92)
      pixels[index + 1] = clampChannel(green * 1.02 + 2)
      pixels[index + 2] = clampChannel(blue * 1.1 + 8)
    } else if (filterId === FILTERS.FADE) {
      pixels[index] = clampChannel(luminance + (red - luminance) * 0.48 + 12)
      pixels[index + 1] = clampChannel(luminance + (green - luminance) * 0.48 + 12)
      pixels[index + 2] = clampChannel(luminance + (blue - luminance) * 0.48 + 14)
    } else if (filterId === FILTERS.CONTRAST) {
      pixels[index] = clampChannel((red - 128) * 1.28 + 128)
      pixels[index + 1] = clampChannel((green - 128) * 1.28 + 128)
      pixels[index + 2] = clampChannel((blue - 128) * 1.28 + 128)
    }
  }

  return imageData
}

function applyOverlayFilter(targetCtx, filterId, width, height, seed = 0) {
  if (filterId === FILTERS.GRAIN) {
    const grainImage = targetCtx.getImageData(0, 0, width, height)
    const pixels = grainImage.data

    for (let index = 0; index < pixels.length; index += 4) {
      const random = Math.sin((index + 1 + seed) * 12.9898) * 43758.5453
      const grain = (random - Math.floor(random) - 0.5) * 34
      pixels[index] = clampChannel(pixels[index] + grain)
      pixels[index + 1] = clampChannel(pixels[index + 1] + grain)
      pixels[index + 2] = clampChannel(pixels[index + 2] + grain)
    }

    targetCtx.putImageData(grainImage, 0, 0)
    return
  }

  if (filterId === FILTERS.SCANLINE) {
    targetCtx.save()
    targetCtx.fillStyle = 'rgba(0, 0, 0, 0.12)'

    for (let y = 0; y < height; y += 4) {
      targetCtx.fillRect(0, y, width, 1)
    }

    targetCtx.restore()
  }
}

function drawFilteredImageTile(metrics, source, filterId) {
  const renderSize = Math.max(1, Math.ceil(metrics.tileSize))
  filterCanvas.width = renderSize
  filterCanvas.height = renderSize
  filterCtx.clearRect(0, 0, renderSize, renderSize)
  filterCtx.drawImage(
    state.image,
    source.sx,
    source.sy,
    source.sourceTileWidth,
    source.sourceTileHeight,
    0,
    0,
    renderSize,
    renderSize
  )

  const imageData = filterCtx.getImageData(0, 0, renderSize, renderSize)
  filterCtx.putImageData(applyPixelFilter(imageData, filterId), 0, 0)
  applyOverlayFilter(filterCtx, filterId, renderSize, renderSize, source.sx + source.sy)
  ctx.drawImage(filterCanvas, source.dx, source.dy, metrics.tileSize, metrics.tileSize)
}

function drawImageTile(tile, metrics) {
  const sourceCrop = getGridSourceCrop()
  const sourceTileWidth = sourceCrop.sw / state.gridCols
  const sourceTileHeight = sourceCrop.sh / state.gridRows
  const sx = sourceCrop.sx + tile.sourceCol * sourceTileWidth
  const sy = sourceCrop.sy + tile.sourceRow * sourceTileHeight
  const dx = metrics.offsetX + tile.col * (metrics.tileSize + state.gap)
  const dy = metrics.offsetY + tile.row * (metrics.tileSize + state.gap)
  const filterId = tile.filterId || FILTERS.NONE

  if (filterId !== FILTERS.NONE) {
    drawFilteredImageTile(metrics, {
      sx,
      sy,
      dx,
      dy,
      sourceTileWidth,
      sourceTileHeight,
    }, filterId)
    return
  }

  ctx.drawImage(
    state.image,
    sx,
    sy,
    sourceTileWidth,
    sourceTileHeight,
    dx,
    dy,
    metrics.tileSize,
    metrics.tileSize
  )
}

function drawColorTile(tile, metrics) {
  const dx = metrics.offsetX + tile.col * (metrics.tileSize + state.gap)
  const dy = metrics.offsetY + tile.row * (metrics.tileSize + state.gap)

  ctx.fillStyle = tile.color || state.blockColor
  ctx.fillRect(dx, dy, metrics.tileSize, metrics.tileSize)
}

function drawGridLines(metrics) {
  if (state.gap <= 0) return

  const gridWidth = metrics.tileSize * state.gridCols + state.gap * (state.gridCols - 1)
  const gridHeight = metrics.tileSize * state.gridRows + state.gap * (state.gridRows - 1)

  ctx.fillStyle = state.mode === 'blank' ? BLANK_GRID_LINE_COLOR : state.backgroundColor
  ctx.fillRect(metrics.offsetX, metrics.offsetY, gridWidth, gridHeight)
}

function drawSelection(tile, metrics) {
  const dx = metrics.offsetX + tile.col * (metrics.tileSize + state.gap)
  const dy = metrics.offsetY + tile.row * (metrics.tileSize + state.gap)

  ctx.save()
  ctx.strokeStyle = '#ffffff'
  ctx.lineWidth = 5
  ctx.strokeRect(dx + 2.5, dy + 2.5, metrics.tileSize - 5, metrics.tileSize - 5)
  ctx.strokeStyle = '#1796b5'
  ctx.lineWidth = 2
  ctx.strokeRect(dx + 7, dy + 7, metrics.tileSize - 14, metrics.tileSize - 14)
  ctx.restore()
}

function draw() {
  drawBackground()

  if (!state.image || !state.crop) return

  const metrics = getTileMetrics()
  drawGridLines(metrics)

  state.tiles.forEach((tile) => {
    if (tile.type === 'color') {
      drawColorTile(tile, metrics)
    } else {
      drawImageTile(tile, metrics)
    }
  })

  const selectedTile = getSelectedTile()
  if (selectedTile) {
    drawSelection(selectedTile, metrics)
  }
}

function getCanvasPoint(event) {
  const rect = canvas.getBoundingClientRect()
  const scaleX = canvas.width / rect.width
  const scaleY = canvas.height / rect.height

  return {
    x: (event.clientX - rect.left) * scaleX,
    y: (event.clientY - rect.top) * scaleY,
  }
}

function getTileFromPoint(x, y) {
  const metrics = getTileMetrics()
  const localX = x - metrics.offsetX
  const localY = y - metrics.offsetY
  const step = metrics.tileSize + state.gap
  const col = Math.floor(localX / step)
  const row = Math.floor(localY / step)

  if (row < 0 || row >= state.gridRows || col < 0 || col >= state.gridCols) {
    return null
  }

  const tileX = localX - col * step
  const tileY = localY - row * step

  if (tileX > metrics.tileSize || tileY > metrics.tileSize) {
    return null
  }

  return state.tiles.find((tile) => tile.row === row && tile.col === col) || null
}

function getSelectedTile() {
  return state.tiles.find((tile) => tile.id === state.selectedTileId) || null
}

function updateSelectedTileUi() {
  const selectedTile = getSelectedTile()
  const hasSelection = Boolean(selectedTile)

  tilePopover?.classList.toggle('hidden', !hasSelection)
  updateColorControls(hasSelection)
  updateFilterControls()
  colorTileButton.disabled = !hasSelection
  restoreTileButton.disabled = !hasSelection
  randomTileButton.disabled = !hasSelection
  clearSelectionButton.disabled = !hasSelection

  if (!selectedTile) {
    selectedTileText.textContent = '点击画布中的任意格子进行编辑'
    return
  }

  const filterText =
    selectedTile.type === 'image'
      ? ` / 滤镜：${FILTER_LABELS[selectedTile.filterId || FILTERS.NONE]}`
      : ''
  selectedTileText.textContent = `已选中：第 ${selectedTile.row + 1} 行 / 第 ${
    selectedTile.col + 1
  } 列${filterText}`
}

function handleCanvasClick(event) {
  if (!state.image || state.toolMode !== TOOL_MODES.TILE_EDIT) return

  const point = getCanvasPoint(event)
  const clickedTile = getTileFromPoint(point.x, point.y)

  if (!clickedTile) {
    state.selectedTileId = null
    updateSelectedTileUi()
    draw()
    return
  }

  if (!state.selectedTileId) {
    state.selectedTileId = clickedTile.id
    updateSelectedTileUi()
    draw()
    return
  }

  if (state.selectedTileId === clickedTile.id) {
    state.selectedTileId = null
    updateSelectedTileUi()
    draw()
    return
  }

  const selectedTile = getSelectedTile()
  if (selectedTile) {
    swapTileContent(selectedTile, clickedTile)
  }

  state.selectedTileId = null
  updateSelectedTileUi()
  draw()
}

function handleImagePointerDown(event) {
  if (!state.image || state.toolMode !== TOOL_MODES.IMAGE_ADJUST) return

  canvas.setPointerCapture?.(event.pointerId)
  state.isDraggingImage = true
  state.dragStart = {
    x: event.clientX,
    y: event.clientY,
    offsetX: state.imageTransform.offsetX,
    offsetY: state.imageTransform.offsetY,
  }
}

function handleImagePointerMove(event) {
  if (!state.isDraggingImage || !state.dragStart || !state.crop) return

  const dx = event.clientX - state.dragStart.x
  const dy = event.clientY - state.dragStart.y
  state.imageTransform.offsetX = state.dragStart.offsetX - (dx * state.crop.sw) / canvas.width
  state.imageTransform.offsetY = state.dragStart.offsetY - (dy * state.crop.sh) / canvas.height
  updateCropFromTransform()
  draw()
}

function handleImagePointerUp(event) {
  if (!state.isDraggingImage) return

  canvas.releasePointerCapture?.(event.pointerId)
  state.isDraggingImage = false
  state.dragStart = null
}

function convertSelectedTileToColor() {
  const selectedTile = getSelectedTile()
  if (!selectedTile) return

  selectedTile.type = 'color'
  selectedTile.color = state.blockColor
  selectedTile.filterId = FILTERS.NONE
  updateSelectedTileUi()
  draw()
}

function restoreSelectedTile() {
  const selectedTile = getSelectedTile()
  if (!selectedTile) return

  selectedTile.sourceRow = selectedTile.row
  selectedTile.sourceCol = selectedTile.col
  selectedTile.type = 'image'
  selectedTile.color = null
  selectedTile.filterId = FILTERS.NONE
  updateSelectedTileUi()
  draw()
}

function randomizeSelectedTile() {
  const selectedTile = getSelectedTile()
  if (!selectedTile) return

  const randomTile = state.tiles[Math.floor(Math.random() * state.tiles.length)]
  selectedTile.sourceRow = randomTile.sourceRow
  selectedTile.sourceCol = randomTile.sourceCol
  selectedTile.type = randomTile.type
  selectedTile.color = randomTile.color
  selectedTile.filterId = randomTile.filterId || FILTERS.NONE
  if (selectedTile.type === 'color') {
    selectedTile.filterId = FILTERS.NONE
  }
  updateSelectedTileUi()
  draw()
}

function applyColorToSelectedTile(color) {
  state.blockColor = color
  blockColorInput.value = color

  const selectedTile = getSelectedTile()

  if (selectedTile?.type === 'color') {
    selectedTile.color = color
  }

  updateSelectedTileUi()
  draw()
}

function exportCanvas() {
  if (!state.image) return

  const selectedTileId = state.selectedTileId
  state.selectedTileId = null
  draw()

  canvas.toBlob((blob) => {
    state.selectedTileId = selectedTileId
    updateSelectedTileUi()
    draw()

    if (!blob) return

    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `mosaic-lab-${Date.now()}.png`
    link.click()
    URL.revokeObjectURL(url)
  }, 'image/png')
}

function updateModeDefaults(mode) {
  if (mode === 'border') {
    state.shuffleStrength = 0.18
    state.gridCols = 9
    state.gap = 3
  } else if (mode === 'blank') {
    state.shuffleStrength = 0.1
    state.gridCols = 12
    state.gap = 1
  } else if (mode === 'colorful') {
    state.shuffleStrength = 0.28
    state.gridCols = 10
    state.gap = 2
  } else {
    state.shuffleStrength = 0.55
    state.gridCols = 10
    state.gap = 2
  }

  strengthRange.value = String(Math.round(state.shuffleStrength * 100))
  gridSelect.value = String(state.gridCols)
  gapRange.value = String(state.gap)
  applyModeColorDefaults()
  updateControlLabels()
}

function updateControlLabels() {
  gapValue.textContent = `${state.gap}px`
  strengthValue.textContent = `${Math.round(state.shuffleStrength * 100)}%`
  updateStats()
}

function updateColorControls(hasSelection = Boolean(getSelectedTile())) {
  blockColorInput.disabled = false
}

function updateRatioControls() {
  document.querySelectorAll('[data-ratio-id]').forEach((button) => {
    button.classList.toggle('active', button.dataset.ratioId === state.aspectRatioId)
  })
}

function updateFilterControls() {
  const selectedTile = getSelectedTile()
  const selectedFilterId =
    selectedTile && selectedTile.type === 'image' ? selectedTile.filterId || FILTERS.NONE : FILTERS.NONE
  const disabled = !selectedTile || selectedTile.type !== 'image'

  filterOptions?.querySelectorAll('[data-filter-id]').forEach((button) => {
    button.disabled = disabled
    button.classList.toggle('active', button.dataset.filterId === selectedFilterId)
  })
}

function selectPaletteColor(color) {
  const selectedTile = getSelectedTile()

  if (selectedTile?.type === 'color') {
    applyColorToSelectedTile(color)
    return
  }

  state.blockColor = color
  blockColorInput.value = color

  if (!selectedTile && (state.mode === 'border' || state.mode === 'blank')) {
    state.backgroundColor = color
    backgroundColorInput.value = color
  }

  updateSelectedTileUi()
  draw()
}

function setFilter(filterId) {
  const selectedTile = getSelectedTile()

  if (!selectedTile) {
    footerHint.textContent = '先选中一个图片格，再给这个格子单独添加滤镜。'
    updateFilterControls()
    return
  }

  if (selectedTile.type !== 'image') {
    footerHint.textContent = '滤镜只作用于图片格，纯色色块会保持原色。'
    updateFilterControls()
    return
  }

  selectedTile.filterId = filterId
  updateFilterControls()
  updateSelectedTileUi()
  draw()
}

function renderRatioOptions() {
  ratioOptions.innerHTML = ''

  ASPECT_RATIOS.forEach((ratio) => {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'ratio-button'
    button.dataset.ratioId = ratio.id
    button.textContent = ratio.label
    button.addEventListener('click', () => {
      setAspectRatio(ratio.id)
    })
    ratioOptions.appendChild(button)
  })

  updateRatioControls()
}

function setToolMode(toolMode) {
  state.toolMode = toolMode
  state.selectedTileId = null
  state.isDraggingImage = false
  updateSelectedTileUi()
  imageAdjustTool.classList.toggle('active', toolMode === TOOL_MODES.IMAGE_ADJUST)
  tileEditTool.classList.toggle('active', toolMode === TOOL_MODES.TILE_EDIT)
  canvas.classList.toggle('is-adjusting-image', toolMode === TOOL_MODES.IMAGE_ADJUST)

  footerHint.textContent =
    toolMode === TOOL_MODES.IMAGE_ADJUST
      ? '拖动画布移动图片，使用缩放滑杆调整大小。'
      : '点击一个格子选中，再点击另一个格子交换。按 R 可以重新随机。'

  draw()
}

function updateStats() {
  if (gridStats) {
    gridStats.textContent = `${state.gridCols} x ${state.gridRows}`
  }

  if (tileStats) {
    tileStats.textContent = String(state.gridCols * state.gridRows)
  }

}

function enableEditingControls() {
  emptyState.classList.add('hidden')
  shuffleButton.disabled = false
  exportButton.disabled = false
  imageAdjustTool.disabled = false
  tileEditTool.disabled = false
  resetImageButton.disabled = false
  fitImageButton.disabled = false
  if (generateButton) {
    generateButton.disabled = false
  }
}

function renderPalette() {
  palette.innerHTML = ''

  getPaletteColorsForMode().forEach((color) => {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'palette-swatch'
    button.style.backgroundColor = color
    button.setAttribute('aria-label', `选择颜色 ${color}`)
    button.addEventListener('click', () => {
      selectPaletteColor(color)
    })
    palette.appendChild(button)
  })
}

async function handleFileChange(event) {
  const file = event.target.files?.[0]
  await processImageFile(file)
}

function handleDragEnter(event) {
  event.preventDefault()
  state.dragDepth += 1
  setUploadDragActive(true)
}

function handleDragOver(event) {
  event.preventDefault()
}

function handleDragLeave(event) {
  event.preventDefault()
  state.dragDepth = Math.max(0, state.dragDepth - 1)
  if (state.dragDepth === 0) {
    setUploadDragActive(false)
  }
}

async function handleDrop(event) {
  event.preventDefault()
  state.dragDepth = 0
  setUploadDragActive(false)
  const file = event.dataTransfer?.files?.[0]
  await processImageFile(file)
}

async function processImageFile(file) {
  if (!file) return

  if (!file.type.startsWith('image/')) {
    fileStatus.textContent = '暂不支持这个文件格式，请上传 JPG、PNG 或 WebP。'
    return
  }

  if (file.size > 10 * 1024 * 1024) {
    fileStatus.textContent = '图片有点大，建议上传 10MB 以内的图片。'
    return
  }

  try {
    fileStatus.textContent = '图片加载中...'
    const image = await loadImageFromFile(file)
    state.image = image
    state.aspectRatioId = 'original'
    state.aspectRatio = image.width / image.height
    state.imageTransform = { scale: 1, offsetX: 0, offsetY: 0 }
    zoomRange.value = '100'
    updateZoomLabel()
    resizeCanvasForAspectRatio()
    updateRatioControls()
    updateCropFromTransform()
    state.imageColorProfile = getImageColorProfile(image, state.crop)
    applyRecommendedColors(getRecommendedColor(image, state.crop))
    applyModeColorDefaults()
    fileStatus.textContent = `已上传：${file.name}`
    enableEditingControls()
    updateColorControls()
    setToolMode(TOOL_MODES.IMAGE_ADJUST)
    generateMosaic()
  } catch (error) {
    fileStatus.textContent = error.message
  }
}

function bindEvents() {
  imageInput.addEventListener('change', handleFileChange)
  document.addEventListener('dragenter', handleDragEnter)
  document.addEventListener('dragover', handleDragOver)
  document.addEventListener('dragleave', handleDragLeave)
  document.addEventListener('drop', handleDrop)
  canvas.addEventListener('click', handleCanvasClick)
  canvas.addEventListener('pointerdown', handleImagePointerDown)
  canvas.addEventListener('pointermove', handleImagePointerMove)
  canvas.addEventListener('pointerup', handleImagePointerUp)
  canvas.addEventListener('pointercancel', handleImagePointerUp)

  shuffleButton.addEventListener('click', generateMosaic)
  generateButton?.addEventListener('click', generateMosaic)
  exportButton.addEventListener('click', exportCanvas)
  imageAdjustTool.addEventListener('click', () => setToolMode(TOOL_MODES.IMAGE_ADJUST))
  tileEditTool.addEventListener('click', () => setToolMode(TOOL_MODES.TILE_EDIT))
  resetImageButton.addEventListener('click', resetImageTransform)
  fitImageButton.addEventListener('click', resetImageTransform)
  zoomRange.addEventListener('input', (event) => updateImageZoom(event.target.value))

  filterOptions?.querySelectorAll('[data-filter-id]').forEach((button) => {
    button.addEventListener('click', () => setFilter(button.dataset.filterId))
  })

  document.querySelectorAll('input[name="mode"]').forEach((input) => {
    input.addEventListener('change', (event) => {
      state.mode = event.target.value
      updateModeDefaults(state.mode)
      updateColorControls()
      generateMosaic()
    })
  })

  gridSelect.addEventListener('change', (event) => {
    state.gridCols = Number(event.target.value)
    generateMosaic()
  })

  gapRange.addEventListener('input', (event) => {
    state.gap = Number(event.target.value)
    updateControlLabels()
    draw()
  })

  strengthRange.addEventListener('input', (event) => {
    state.shuffleStrength = Number(event.target.value) / 100
    updateControlLabels()
    if (state.mode === 'blank') {
      generateMosaic()
    }
  })

  strengthRange.addEventListener('change', generateMosaic)

  backgroundColorInput.addEventListener('input', (event) => {
    state.backgroundColor = event.target.value
    draw()
  })

  blockColorInput.addEventListener('input', (event) => {
    applyColorToSelectedTile(event.target.value)
  })

  colorTileButton.addEventListener('click', convertSelectedTileToColor)
  restoreTileButton.addEventListener('click', restoreSelectedTile)
  randomTileButton.addEventListener('click', randomizeSelectedTile)
  clearSelectionButton.addEventListener('click', () => {
    state.selectedTileId = null
    updateSelectedTileUi()
    draw()
  })

  document.addEventListener('keydown', (event) => {
    if (event.key.toLowerCase() === 'r' && state.image) {
      generateMosaic()
    }
  })

  document.querySelectorAll('[data-panel-trigger]').forEach((trigger) => {
    trigger.addEventListener('click', () => {
      const panelName = trigger.dataset.panelTrigger
      const item = document.querySelector(`.accordion-item[data-panel="${panelName}"]`)
      const isActive = !item?.classList.contains('active')

      item?.classList.toggle('active', isActive)
      item?.querySelector('.nav-item')?.classList.toggle('active', isActive)
    })
  })
}

function init() {
  renderRatioOptions()
  renderPalette()
  updateControlLabels()
  updateZoomLabel()
  updateFilterControls()
  updateColorControls()
  drawBackground()
  bindEvents()
}

init()
