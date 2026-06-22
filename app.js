const canvas = document.querySelector('#mosaicCanvas')
const ctx = canvas.getContext('2d')

const imageInput = document.querySelector('#imageInput')
const fileStatus = document.querySelector('#fileStatus')
const emptyState = document.querySelector('#emptyState')
const shuffleButton = document.querySelector('#shuffleButton')
const exportButton = document.querySelector('#exportButton')
const generateButton = document.querySelector('#generateButton')
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
const gridStats = document.querySelector('#gridStats')
const tileStats = document.querySelector('#tileStats')

const DEFAULT_COLORS = ['#f5f5f7', '#ffffff', '#0066ff', '#1d1d1f', '#d2d2d7', '#ff5733']

const state = {
  image: null,
  crop: null,
  tiles: [],
  selectedTileId: null,
  mode: 'light',
  gridCols: 9,
  gridRows: 12,
  gap: 3,
  shuffleStrength: 0.18,
  backgroundColor: '#f5f5f7',
  blockColor: '#0066ff',
}

function toHex(value) {
  return Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, '0')
}

function rgbToHex(r, g, b) {
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
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

function applyRecommendedColors(color) {
  state.backgroundColor = color
  state.blockColor = color
  backgroundColorInput.value = color
  blockColorInput.value = color
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
  state.gridRows = Math.round(state.gridCols * (canvas.height / canvas.width))
  updateStats()
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
  }

  a.sourceRow = b.sourceRow
  a.sourceCol = b.sourceCol
  a.type = b.type
  a.color = b.color

  b.sourceRow = snapshot.sourceRow
  b.sourceCol = snapshot.sourceCol
  b.type = snapshot.type
  b.color = snapshot.color
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
  }))

  shuffleArray(sources)

  candidates.forEach((tile, index) => {
    tile.sourceRow = sources[index].sourceRow
    tile.sourceCol = sources[index].sourceCol
    tile.type = sources[index].type
    tile.color = sources[index].color
  })

  return nextTiles
}

function applyColorBlocks(tiles) {
  const nextTiles = cloneTiles(tiles)
  if (state.mode !== 'light') return nextTiles

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

  calculateGridRows()
  const originalTiles = createTiles()
  const shuffledTiles =
    state.mode === 'light' ? applyLightShuffle(originalTiles) : applyRemixShuffle(originalTiles)

  state.tiles = applyColorBlocks(shuffledTiles)
  state.selectedTileId = null
  updateSelectedTileUi()
  draw()
}

function getTileMetrics() {
  const borderPadding = state.mode === 'light' ? Math.round(canvas.width * 0.1) : 0
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

function drawBackground() {
  ctx.fillStyle = state.backgroundColor
  ctx.fillRect(0, 0, canvas.width, canvas.height)
}

function drawImageTile(tile, metrics) {
  const sourceTileWidth = state.crop.sw / state.gridCols
  const sourceTileHeight = state.crop.sh / state.gridRows
  const sx = state.crop.sx + tile.sourceCol * sourceTileWidth
  const sy = state.crop.sy + tile.sourceRow * sourceTileHeight
  const dx = metrics.offsetX + tile.col * (metrics.tileSize + state.gap)
  const dy = metrics.offsetY + tile.row * (metrics.tileSize + state.gap)

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
  colorTileButton.disabled = !hasSelection
  restoreTileButton.disabled = !hasSelection
  randomTileButton.disabled = !hasSelection
  clearSelectionButton.disabled = !hasSelection

  if (!selectedTile) {
    selectedTileText.textContent = '点击画布中的任意格子进行编辑'
    return
  }

  selectedTileText.textContent = `已选中：第 ${selectedTile.row + 1} 行 / 第 ${
    selectedTile.col + 1
  } 列`
}

function handleCanvasClick(event) {
  if (!state.image) return

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

function convertSelectedTileToColor() {
  const selectedTile = getSelectedTile()
  if (!selectedTile) return

  selectedTile.type = 'color'
  selectedTile.color = state.blockColor
  draw()
}

function restoreSelectedTile() {
  const selectedTile = getSelectedTile()
  if (!selectedTile) return

  selectedTile.sourceRow = selectedTile.row
  selectedTile.sourceCol = selectedTile.col
  selectedTile.type = 'image'
  selectedTile.color = null
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
  draw()
}

function syncColorBlocksToCurrentColor() {
  state.tiles.forEach((tile) => {
    if (tile.type === 'color') {
      tile.color = state.blockColor
    }
  })
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
  if (mode === 'light') {
    state.shuffleStrength = 0.18
    state.gridCols = 9
    state.gap = 3
  } else {
    state.shuffleStrength = 0.55
    state.gridCols = 10
    state.gap = 2
  }

  strengthRange.value = String(Math.round(state.shuffleStrength * 100))
  gridSelect.value = String(state.gridCols)
  gapRange.value = String(state.gap)
  updateControlLabels()
}

function updateControlLabels() {
  gapValue.textContent = `${state.gap}px`
  strengthValue.textContent = `${Math.round(state.shuffleStrength * 100)}%`
  updateStats()
}

function updateColorControls(hasSelection = Boolean(getSelectedTile())) {
  blockColorInput.disabled = state.mode === 'remix' && !hasSelection
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
  if (generateButton) {
    generateButton.disabled = false
  }
}

function renderPalette() {
  palette.innerHTML = ''

  DEFAULT_COLORS.forEach((color) => {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'palette-swatch'
    button.style.backgroundColor = color
    button.setAttribute('aria-label', `选择颜色 ${color}`)
    button.addEventListener('click', () => {
      state.backgroundColor = color
      backgroundColorInput.value = color
      draw()
    })
    palette.appendChild(button)
  })
}

async function handleFileChange(event) {
  const file = event.target.files?.[0]
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
    state.crop = getCenterCropRect(image.width, image.height, canvas.width / canvas.height)
    applyRecommendedColors(getRecommendedColor(image, state.crop))
    fileStatus.textContent = `已上传：${file.name}`
    enableEditingControls()
    updateColorControls()
    generateMosaic()
  } catch (error) {
    fileStatus.textContent = error.message
  }
}

function bindEvents() {
  imageInput.addEventListener('change', handleFileChange)
  canvas.addEventListener('click', handleCanvasClick)

  shuffleButton.addEventListener('click', generateMosaic)
  generateButton?.addEventListener('click', generateMosaic)
  exportButton.addEventListener('click', exportCanvas)

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
  })

  strengthRange.addEventListener('change', generateMosaic)

  backgroundColorInput.addEventListener('input', (event) => {
    state.backgroundColor = event.target.value
    draw()
  })

  blockColorInput.addEventListener('input', (event) => {
    state.blockColor = event.target.value
    syncColorBlocksToCurrentColor()
    draw()
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
  renderPalette()
  updateControlLabels()
  updateColorControls()
  drawBackground()
  bindEvents()
}

init()
