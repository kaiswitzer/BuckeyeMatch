import { Link } from 'react-router-dom'

export default function AppHeader({
  title,
  right = null,
  showBack = false,
  onBack,
  // Back-compat: older call sites pass maxWidthClassName, but by default
  // we render full-width so the title is centered on the viewport.
  maxWidthClassName = 'max-w-4xl',
  fullWidth = true,
  variant = 'light', // light | scarlet
}) {
  const isScarlet = variant === 'scarlet'
  const containerClassName = fullWidth
    ? 'w-full px-4 py-4'
    : `${maxWidthClassName} mx-auto px-4 py-4`

  return (
    <header
      className={`sticky top-0 z-10 ${
        isScarlet ? '' : 'bg-white border-b border-gray-100'
      }`}
      style={isScarlet ? { backgroundColor: '#BB0000' } : undefined}
    >
      <div className={containerClassName}>
        <div className="relative flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 justify-start min-w-0">
            {showBack && (
              <button
                type="button"
                onClick={onBack}
                className={`transition-colors text-lg leading-none ${
                  isScarlet ? 'text-white/80 hover:text-white' : 'text-gray-400 hover:text-gray-700'
                }`}
                aria-label="Back"
              >
                ←
              </button>
            )}
            <Link
              to="/"
              state={{ allowLanding: true }}
              className="font-bold text-base tracking-tight hover:opacity-80 transition-opacity truncate"
              style={isScarlet ? { color: 'white' } : { color: '#BB0000' }}
            >
              BuckeyeMatch
            </Link>
          </div>

          {title && (
            <div className="absolute left-1/2 -translate-x-1/2 max-w-[60%] px-2 pointer-events-none">
              <span className={`block text-sm font-semibold truncate text-center ${isScarlet ? 'text-white' : 'text-gray-900'}`}>
                {title}
              </span>
            </div>
          )}

          <div className="flex items-center justify-end min-w-0">
            {right}
          </div>
        </div>
      </div>
    </header>
  )
}

