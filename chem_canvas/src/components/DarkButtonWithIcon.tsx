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
      className={`inline-flex items-center justify-center rounded-lg border border-zinc-700/50 px-6 py-3 text-center text-sm font-semibold text-white shadow-lg transition-all duration-200 backdrop-blur-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100 ${className}`}
      style={{ 
        backgroundColor: disabled ? '#171717' : '#212121',
      }}
    >
      {children}
    </button>
  )
}

export default DarkButtonWithIcon
