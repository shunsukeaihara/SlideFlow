# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

SlideFlow is a client-side web application for editing NotebookLM-generated slide PDFs using Google's Gemini AI. The app runs entirely in the browser with no backend - data is only sent to the Gemini API for image generation.

## Development Commands

```bash
# Install dependencies (requires Node.js 22.x, Yarn 4.x)
yarn install

# Start development server (http://localhost:5173)
yarn dev

# Type checking (run before committing)
yarn typecheck

# Linting
yarn lint

# Format code
yarn format

# Production build (outputs to dist/)
yarn build

# Preview production build
yarn preview
```

## Core Architecture

### State Management (Zustand)

The entire application state is managed through a single Zustand store at [src/stores/projectStore.ts](src/stores/projectStore.ts). This includes:

- **Project data**: Current project, slides, edit history
- **UI state**: Selected slide, loading states
- **App settings**: Gemini API key (stored in localStorage)

**Key actions:**

- `setProject(project)` - Load a project
- `updateSlideImage(slideId, dataUrl)` - Update slide's current image
- `addEditHistory(slideId, entry)` - Add edit to slide history
- `revertToHistory(slideId, historyId)` - Revert slide to previous edit
- `reorderSlides(activeId, overId)` - Drag-and-drop reordering
- `addSlide()` / `deleteSlide()` - Slide management
- `setSlideOcrResult(slideId, ocrResult)` - Cache OCR results for a slide
- `clearSlideOcrResult(slideId)` - Clear OCR cache

### Data Model Architecture

#### Critical: Centralized Image Storage

The project uses a **dictionary-based image storage** pattern to avoid duplication:

- All images stored in `project.images` (Record<string, Image>) as a flat dictionary
- Images have unique IDs and order numbers for serialization
- Slides reference images by ID through `originalImageId` and `currentImageId`
- Edit history references images by ID through `sourceImageId` and `resultImageId`
- Reference images in edit history also stored by ID in `referenceImageIds`

#### Why this matters

- Prevents storing duplicate image data across edit history
- An image used multiple times (e.g., as reference) only exists once in `project.images`
- When creating new images (edits, uploads), add to `project.images` first, then reference by ID
- When saving/loading, images are serialized as sorted array by order number

#### Image lifecycle

1. Create new Image object with unique ID and next order number
2. Add to `project.images` dictionary
3. Reference the image ID in slide or history entry
4. When saving to ZIP, convert dictionary to sorted array for stable serialization

### Project File Format (Version 2)

Projects are saved as `.sfpj` files (ZIP archives):

```plaintext
project.sfpj
├── project.json          # Metadata only (version, settings, image paths)
└── images/
    ├── slide-1-original.webp
    ├── slide-1-current.webp
    ├── slide-2-hist-0-source.webp
    ├── slide-2-hist-0-result.webp
    └── ...
```

**Version Management:**

- Version 1 (legacy): Images stored as Base64 strings in JSON
- Version 2 (current): Images as binary WebP files, paths in JSON
- Load function supports both versions for backward compatibility

**Implementation:** [src/lib/projectFile.ts](src/lib/projectFile.ts)

### PDF Processing Pipeline

1. **Import** ([src/lib/pdf.ts](src/lib/pdf.ts)):
   - PDF.js renders each page to canvas at scale 1.0 (original resolution)
   - Canvas converted to WebP format (90% quality) via `toDataURL('image/webp', 0.90)`
   - Critical: Scale must remain 1.0 to avoid file bloat

2. **Edit** ([src/lib/gemini.ts](src/lib/gemini.ts)):
   - Current slide image sent to Gemini API with user prompt
   - Optional reference images for style consistency
   - System prompt applied if configured
   - Model: `gemini-3-pro-image-preview`
   - Response modalities: `['Text', 'Image']`

3. **Save** ([src/lib/projectFile.ts](src/lib/projectFile.ts)):
   - Extract all data URLs to binary WebP files
   - Package with JSZip (DEFLATE level 9 compression)
   - Download as `.enlm` file

4. **Export** ([src/lib/pdf.ts](src/lib/pdf.ts)):
   - Convert edited slides to PDF using jsPDF
   - Each slide becomes a page matching original dimensions

### Image Optimization History

The project underwent significant optimization to reduce file size:

**Problem:** 10MB PDF → 80MB project file (8x bloat)

**Solution (3 phases):**

1. **Scale reduction** (75% savings): Changed PDF rendering scale from 2.0 to 1.0 at [src/lib/pdf.ts:29](src/lib/pdf.ts#L29)
2. **WebP format** (65% additional): Changed from PNG to WebP at [src/lib/pdf.ts:44](src/lib/pdf.ts#L44)
3. **Binary storage** (25% additional): Moved images from Base64 in JSON to binary files in ZIP

**Result:** 80MB → 3.4-4.1MB (95% reduction)

**Important:** Do not change the scale or format without understanding the performance impact.

### Architecture Evolution: Dictionary-Based Storage

**Migration (January 2026):** The project was refactored from storing images directly in slides to a centralized dictionary pattern.

**Before (embedded images):**

```typescript
interface Slide {
  image: {
    originalDataUrl: string
    currentDataUrl: string
  }
  editHistory: [
    {
      sourceImageDataUrl: string
      resultImageDataUrl: string
    }
  ]
}
```

**After (image references):**

```typescript
interface Project {
  images: Record<string, Image> // Centralized storage
  slides: Slide[]
}
interface Slide {
  image: {
    originalImageId: string // Reference to project.images
    currentImageId: string
  }
  editHistory: [
    {
      sourceImageId: string
      resultImageId: string
    }
  ]
}
```

**Benefits:**

- **Deduplication**: Same image used as reference in multiple edits only stored once
- **OCR caching**: OCR results stored in Image object, shared across all references
- **Cleaner serialization**: Images serialized as sorted array, stable output format
- **Memory efficiency**: Reduces runtime memory when images are reused

**When to use this pattern:**

- Any feature that creates or stores images
- Any feature that needs to track image relationships
- When implementing new edit operations or transformations

## Key Type Definitions

Located in [src/types/project.ts](src/types/project.ts):

```typescript
interface Project {
  version?: number // 1 = legacy, 2 = binary
  id: string
  name: string
  createdAt: number
  updatedAt: number
  slides: Slide[]
  images: Record<string, Image> // All images keyed by ID
  settings: ProjectSettings
}

interface Slide {
  id: string
  pageNumber: number
  image: SlideImage
  editHistory: EditHistoryEntry[]
}

interface SlideImage {
  id: string
  pageNumber: number
  originalImageId: string // ID in project.images
  currentImageId: string // ID in project.images
}

interface Image {
  id: string
  order: number // For serialization order
  dataUrl: string // Runtime: data URL
  fileType: string // 'image/webp', 'image/png', etc.
  imagePath?: string // Version 2: path in ZIP
  width: number
  height: number
  ocrCache?: OcrResult // Cached OCR results
}

interface EditHistoryEntry {
  id: string
  timestamp: number
  sourceImageId: string // ID in project.images
  resultImageId: string // ID in project.images
  prompt: string // User's edit instruction
  referenceImageIds?: string[] // IDs in project.images
}

interface OcrResult {
  textBlocks: OcrTextBlock[]
  fullText: string
  metadata: {
    tesseractRaw: OcrTextBlock[]
    engine: 'tesseract+gemini'
    timestamp: number
  }
}

interface OcrTextBlock {
  text: string
  bbox: { x: number; y: number; width: number; height: number }
  confidence?: number
  lines?: Array<{
    text: string
    bbox: { x: number; y: number; width: number; height: number }
  }>
}
```

**Data URL Pattern:** All images in memory are stored as data URLs (`data:image/webp;base64,...`). When saving to file, these are converted to binary and paths are stored in the JSON.

## Component Structure

### Main Pages

- [src/pages/HomePage.tsx](src/pages/HomePage.tsx) - Project creation and loading
- [src/pages/EditorPage.tsx](src/pages/EditorPage.tsx) - Main editing interface
- [src/pages/SettingsPage.tsx](src/pages/SettingsPage.tsx) - API key and system prompt configuration

### Editor Page Architecture

The editor is split into three main areas:

1. **Left Sidebar** - Slide thumbnails with drag-and-drop reordering (`@dnd-kit/sortable`)
2. **Center Panel** - Large slide preview + prompt input + reference image selector + OCR overlay
3. **Right Drawer** - Edit history and slide settings (Sheet component)

**State flow:**

```plaintext
User enters prompt → handleEdit() → editImage() (Gemini API)
  → addEditHistory() (Zustand) → updateSlideImage() (Zustand)
  → UI auto-updates via Zustand subscription
```

**Reference images:**

- Can select other slides or upload custom images
- Uploaded images added to `project.images` with unique IDs
- Reference images stored by ID in edit history (`referenceImageIds`)
- Unused reference images are filtered out when saving to reduce file size

### OCR System

**Architecture:** Hybrid approach combining Tesseract.js (position detection) + Gemini (accuracy refinement)

**Components:**

- [src/lib/ocr.ts](src/lib/ocr.ts) - Main OCR interface and pipeline
- [src/lib/ocr-tesseract.ts](src/lib/ocr-tesseract.ts) - Tesseract.js implementation for bbox detection
- [src/lib/ocr-gemini.ts](src/lib/ocr-gemini.ts) - Gemini refinement for text accuracy
- [src/components/SlideToolbar.tsx](src/components/SlideToolbar.tsx) - Draggable floating toolbar
- [src/components/OcrOverlay.tsx](src/components/OcrOverlay.tsx) - Interactive text overlay with bboxes

**OCR Pipeline:**

1. **Tesseract Phase**: Extract text blocks with bounding boxes (Japanese + English support)
2. **Gemini Refinement** (optional): Improve text accuracy while preserving bboxes
3. **Result Caching**: Store in `image.ocrCache` to avoid reprocessing
4. **UI Display**: Render interactive overlay with selectable text blocks

**OCR Overlay Features:**

- Text blocks displayed with blue bounding boxes
- Hover to preview text in tooltip
- Click to show context menu with copy option
- Scales dynamically with image size changes
- Uses ResizeObserver to handle container resizing

**SlideToolbar Features:**

- Draggable floating toolbar (constrained to container bounds)
- Minimize/maximize functionality
- OCR execution, visibility toggle, and cache clearing
- Positioned at top-left by default, user can reposition

### Drag and Drop

Uses `@dnd-kit` for accessible drag-and-drop:

- `DndContext` wraps the sortable list
- `SortableContext` with `verticalListSortingStrategy`
- Each slide is a `SortableSlideItem` with a grip handle
- `onDragEnd` calls `reorderSlides(activeId, overId)`

## Critical Implementation Details

### API Key Management

- API key stored in localStorage at key `slideflow-api-key`
- Loaded on app start via `loadApiKey()` action
- Gemini client initialized lazily when first needed
- If API key is missing during edit, user is redirected to settings page

### Edit History

- Each edit creates a new `EditHistoryEntry` with source/result images
- History is append-only (no deletion except whole slide deletion)
- "Revert to history" doesn't delete history - it just updates `currentDataUrl`
- "オリジナルに戻す" creates a new history entry reverting to original

### Slide Operations

**Add slide:**

- Context menu on existing slides: "前にスライドを追加" / "後にスライドを追加"
- Opens `AddSlideDialog` which can:
  - Generate new slide from scratch using Gemini
  - Upload an image file
- New slide inserted at specified index
- Initial generation is saved in edit history

**Delete slide:**

- Context menu on slide thumbnail
- Minimum 1 slide must remain (delete button disabled otherwise)
- Deletes all edit history for that slide
- Confirmation dialog shown

**Reorder slides:**

- Drag grip handle appears on hover
- Drag slide to new position
- Page numbers automatically renumbered

### Image Data Flow

**At runtime:**

- All images stored in `project.images` dictionary with data URLs
- Each image has unique ID and order number
- `dataUrl` field populated with image data
- Path fields (`imagePath`) are empty/undefined
- OCR results cached in `image.ocrCache` if available

**When saving:**

1. Create a deep copy of project data
2. Set `version: 2`
3. Iterate through `project.images` and generate paths (e.g., `images/img-{id}.webp`)
4. Convert data URLs to binary Uint8Array
5. Add binary files to ZIP
6. Clear `dataUrl` fields in the copy (save space)
7. Serialize `project.images` as sorted array (by order number)
8. Serialize JSON and add to ZIP

**When loading:**

1. Unzip and read `project.json`
2. Check version field
3. Deserialize images array back to dictionary (keyed by ID)
4. If version 2: Load binary images from `images/` folder
5. Convert binary to data URLs
6. Populate `dataUrl` fields for runtime use
7. Images dictionary ready for use by slides and history

## Gemini API Integration

**Model:** `gemini-3-pro-image-preview`

**Request format:**

```typescript
{
  model: 'gemini-3-pro-image-preview',
  contents: [
    { text: prompt },
    { inlineData: { mimeType: 'image/webp', data: base64 } }
  ],
  config: {
    responseModalities: ['Text', 'Image']
  }
}
```

**Response handling:**

- Check `response.candidates[0].content.parts` for parts with `inlineData`
- Extract `mimeType` and `data` (base64)
- Convert to data URL: `data:${mimeType};base64,${data}`

**Error handling:**

- No response: "No response from Gemini"
- No image in response: "No image in response. The model may have returned text only."
- API errors: Display error message to user

## Build Configuration

### Path Aliases

TypeScript and Vite both configured to use `@` alias for `src/`:

```typescript
// tsconfig.web.json
"paths": {
  "@/*": ["src/*"]
}

// vite.config.ts
resolve: {
  alias: {
    '@': resolve(__dirname, 'src')
  }
}
```

**Usage:** `import { useProjectStore } from '@/stores/projectStore'`

### Vite Configuration

- **Root:** `src/` (index.html is at `src/index.html`)
- **Build output:** `dist/` (relative to project root)
- **Plugins:** React, Tailwind CSS
- **PDF.js worker:** Imported as URL via `?url` suffix

### TypeScript Configuration

- **Config file:** `tsconfig.web.json` (not `tsconfig.json`)
- **Target:** ES2020
- **Module:** ESNext with bundler resolution
- **Strict mode:** Enabled
- **Include:** `["src"]`

## Common Patterns

### Adding a new Zustand action

1. Add function signature to `ProjectState` interface
2. Implement in `create<ProjectState>()` callback
3. Use `get()` to access current state, `set()` to update
4. Always update `updatedAt` timestamp when modifying project

### Working with images

**Creating new images:**

```typescript
// 1. Create Image object with unique ID and next order
const imageId = uuidv4()
const order = getNextImageOrder(project.images)
const newImage: Image = {
  id: imageId,
  order,
  dataUrl: imageDataUrl,
  fileType: getFileTypeFromDataUrl(imageDataUrl),
  width,
  height
}

// 2. Add to project.images dictionary
project.images[imageId] = newImage

// 3. Reference by ID in slide or history
slide.image.currentImageId = imageId
```

**Accessing images:**

```typescript
// Get image from slide
const slide = project.slides.find((s) => s.id === slideId)
const currentImage = project.images[slide.image.currentImageId]

// Get images from edit history
const historyEntry = slide.editHistory[0]
const sourceImage = project.images[historyEntry.sourceImageId]
const resultImage = project.images[historyEntry.resultImageId]
```

**Image format rules:**

- Always use data URLs for runtime
- Always use WebP format (90% quality)
- Convert to/from binary for storage
- Don't modify scale or format without consulting optimization history

### Adding UI components

- Use Radix UI primitives from `src/components/ui/`
- Style with Tailwind CSS utility classes
- Use `cn()` helper for conditional classes
- Follow existing patterns for buttons, dialogs, sheets

## Security Considerations

**Personal Use Tool:**

- Designed as a personal productivity tool for users with their own Google AI API keys
- No backend server required - runs entirely in the browser
- API key stored in localStorage (user's responsibility to protect)
- All processing happens in browser
- Each user must obtain and configure their own API key

**For SaaS Deployment:**

If converting to a multi-user SaaS service, implement a backend API that:

- Stores API keys server-side (never exposed to client)
- Proxies Gemini API calls through backend
- Implements user authentication and authorization
- Adds rate limiting and usage monitoring per user
- Provides billing/subscription management
- Manages project storage (currently client-side only)

## Known Limitations

- No undo/redo functionality (use edit history to revert)
- Large PDFs (>50 pages) may cause memory issues
- Reference images are lost if not used in any edit
- API key visible in localStorage (browser dev tools)
