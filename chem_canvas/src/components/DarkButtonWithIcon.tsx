import React from 'react'

interface DarkButtonWithIconProps {
  children: React.ReactNode
  onClick?: () => void
  className?: string
  disabled?: boolean
}

const DarkButtonWithIcon = ({
  children,
  onClick,
  className = '',
  disabled = false
}: DarkButtonWithIconProps) => {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center rounded-full border border-slate-800/80 bg-slate-950/95 px-6 py-3 text-center text-sm font-semibold text-white shadow-lg shadow-slate-900/40 backdrop-blur hover:bg-slate-900 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 disabled:cursor-not-allowed disabled:border-slate-600 disabled:bg-slate-800 disabled:text-slate-400 ${className}`}
    >
      {children}
    </button>
  )
}

export default DarkButtonWithIcon
