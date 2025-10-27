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
      className={`bg-dark dark:bg-dark-2 border-dark dark:border-dark-2 border inline-flex items-center justify-center py-3 px-7 text-center text-base font-medium text-white hover:bg-body-color hover:border-body-color disabled:bg-gray-3 disabled:border-gray-3 disabled:text-dark-5 ${className}`}
    >
      {children}
    </button>
  )
}

export default DarkButtonWithIcon