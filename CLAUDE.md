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

### Project File Format (Version 2)

Projects are saved as `.enlm` files (ZIP archives):

```
project.enlm
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

## Key Type Definitions

Located in [src/types/project.ts](src/types/project.ts):

```typescript
interface Project {
  version?: number        // 1 = legacy, 2 = binary
  id: string
  name: string
  createdAt: number
  updatedAt: number
  slides: Slide[]
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
  originalDataUrl: string       // Runtime: original imported image
  currentDataUrl: string        // Runtime: latest edited version
  originalImagePath?: string    // Version 2: path in ZIP
  currentImagePath?: string     // Version 2: path in ZIP
  width: number
  height: number
}

interface EditHistoryEntry {
  id: string
  timestamp: number
  sourceImageDataUrl: string    // Runtime: before edit
  resultImageDataUrl: string    // Runtime: after edit
  prompt: string                // User's edit instruction
  sourceImagePath?: string      // Version 2: path in ZIP
  resultImagePath?: string      // Version 2: path in ZIP
  referenceImages?: ReferenceImageData[]
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
2. **Center Panel** - Large slide preview + prompt input + reference image selector
3. **Right Drawer** - Edit history and slide settings (Sheet component)

**State flow:**
```
User enters prompt → handleEdit() → editImage() (Gemini API)
  → addEditHistory() (Zustand) → updateSlideImage() (Zustand)
  → UI auto-updates via Zustand subscription
```

**Reference images:**
- Can select other slides or upload custom images
- Uploaded images added to `uploadedImages` state
- Only uploaded images (not slides) are saved to edit history
- Reference images are filtered out if not used in any edit when saving

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
- All images are data URLs in memory
- `originalDataUrl` and `currentDataUrl` fields are populated
- Path fields (`*ImagePath`) are empty/undefined

**When saving:**
1. Create a copy of project data
2. Set `version: 2`
3. Generate paths for all images (e.g., `images/slide-1-original.webp`)
4. Convert data URLs to binary Uint8Array
5. Add binary files to ZIP
6. Clear data URL fields in the copy (save space)
7. Serialize JSON and add to ZIP

**When loading:**
1. Unzip and read `project.json`
2. Check version field
3. If version 2: Load binary images from `images/` folder
4. Convert binary to data URLs
5. Populate `*DataUrl` fields for runtime use

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

**Client-side only:**
- No backend server required
- API key stored in localStorage (not secure for production with sensitive data)
- All processing happens in browser

**Production recommendation:**
For production use with sensitive data, implement a backend API proxy to:
- Store API key server-side
- Rate limit requests
- Monitor usage
- Add authentication

## Known Limitations

- No undo/redo functionality (use edit history to revert)
- Large PDFs (>50 pages) may cause memory issues
- Reference images are lost if not used in any edit
- API key visible in localStorage (browser dev tools)
