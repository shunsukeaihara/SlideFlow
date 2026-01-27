import { useState, useRef, useEffect, useCallback } from 'react'
import { ArrowLeft, Download, Save, Settings, Loader2, Menu, X, Pencil, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useProjectStore } from '@/stores/projectStore'

interface EditorHeaderProps {
  isSaving: boolean
  isExporting: boolean
  onBack: () => void
  onSave: () => void
  onExportPdf: () => void
  onOpenSettings: () => void
}

export function EditorHeader({
  isSaving,
  isExporting,
  onBack,
  onSave,
  onExportPdf,
  onOpenSettings
}: EditorHeaderProps) {
  const { project, updateProjectName } = useProjectStore()
  const projectName = project?.name ?? ''

  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [localEditName, setLocalEditName] = useState('')
  const [isComposing, setIsComposing] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditing])

  const handleMenuAction = (action: () => void) => {
    action()
    setIsMenuOpen(false)
  }

  const handleStartEdit = useCallback(() => {
    setLocalEditName(projectName)
    setIsEditing(true)
  }, [projectName])

  const handleSaveName = useCallback(() => {
    const trimmedName = localEditName.trim()
    if (trimmedName && trimmedName !== projectName) {
      updateProjectName(trimmedName)
    }
    setIsEditing(false)
  }, [localEditName, projectName, updateProjectName])

  const handleCancelEdit = useCallback(() => {
    setIsEditing(false)
  }, [])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && !isComposing) {
        e.preventDefault()
        handleSaveName()
      } else if (e.key === 'Escape') {
        e.preventDefault()
        handleCancelEdit()
      }
    },
    [isComposing, handleSaveName, handleCancelEdit]
  )

  const handleBlur = useCallback(() => {
    // Small delay to allow save button click to register
    setTimeout(() => {
      if (isEditing) {
        handleSaveName()
      }
    }, 150)
  }, [isEditing, handleSaveName])

  return (
    <header className="flex items-center justify-between border-b border-gray-200 px-4 py-2 md:py-3 relative">
      {/* Left: Back button + Project name */}
      <div className={`flex items-center gap-2 md:gap-3 min-w-0 ${isEditing ? 'flex-1' : ''}`}>
        <Button variant="ghost" size="icon" onClick={onBack} className="flex-shrink-0">
          <ArrowLeft className="h-5 w-5" />
        </Button>

        {isEditing ? (
          <div className="flex items-center gap-1 min-w-0 flex-1 md:flex-none md:w-[70vw] md:max-w-xl">
            <Input
              ref={inputRef}
              value={localEditName}
              onChange={(e) => setLocalEditName(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={handleBlur}
              onCompositionStart={() => setIsComposing(true)}
              onCompositionEnd={() => setIsComposing(false)}
              className="h-8 text-base md:text-lg font-semibold flex-1"
              maxLength={100}
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={handleSaveName}
              className="flex-shrink-0 h-8 w-8"
            >
              <Check className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <button
            onClick={handleStartEdit}
            className="flex items-center gap-1.5 group min-w-0 text-left"
            title="クリックして編集"
          >
            <h1 className="text-base md:text-lg font-semibold text-gray-900 truncate">
              {projectName}
            </h1>
            <Pencil className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
          </button>
        )}
      </div>

      {/* Desktop: Action buttons */}
      <div className="hidden md:flex items-center gap-2 flex-shrink-0">
        <Button variant="outline" size="sm" onClick={onSave} disabled={isSaving}>
          {isSaving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              保存中...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              保存
            </>
          )}
        </Button>
        <Button variant="outline" size="sm" onClick={onExportPdf} disabled={isExporting}>
          {isExporting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              出力中...
            </>
          ) : (
            <>
              <Download className="mr-2 h-4 w-4" />
              PDF出力
            </>
          )}
        </Button>
        <Button variant="ghost" size="icon" onClick={onOpenSettings}>
          <Settings className="h-5 w-5" />
        </Button>
      </div>

      {/* Mobile: Hamburger menu button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setIsMenuOpen(!isMenuOpen)}
        className="md:hidden flex-shrink-0"
      >
        {isMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </Button>

      {/* Mobile: Dropdown menu */}
      {isMenuOpen && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40 md:hidden" onClick={() => setIsMenuOpen(false)} />

          {/* Menu */}
          <div className="absolute top-full right-0 mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-50 md:hidden">
            <div className="py-1">
              <button
                onClick={() => handleMenuAction(onSave)}
                disabled={isSaving}
                className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-50"
              >
                {isSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {isSaving ? '保存中...' : '保存'}
              </button>
              <button
                onClick={() => handleMenuAction(onExportPdf)}
                disabled={isExporting}
                className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-50"
              >
                {isExporting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                {isExporting ? '出力中...' : 'PDF出力'}
              </button>
              <div className="border-t border-gray-100 my-1" />
              <button
                onClick={() => handleMenuAction(onOpenSettings)}
                className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
              >
                <Settings className="h-4 w-4" />
                設定
              </button>
            </div>
          </div>
        </>
      )}
    </header>
  )
}
