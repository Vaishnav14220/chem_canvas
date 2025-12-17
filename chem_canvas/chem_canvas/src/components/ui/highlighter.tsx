import { useEffect, useRef } from "react"
import type React from "react"
import { useInView } from "motion/react"
import { annotate } from "rough-notation"
import { type RoughAnnotation } from "rough-notation/lib/model"

type AnnotationAction =
  | "highlight"
  | "underline"
  | "box"
  | "circle"
  | "strike-through"
  | "crossed-off"
  | "bracket"

interface HighlighterProps {
  children: React.ReactNode
  action?: AnnotationAction
  color?: string
  strokeWidth?: number
  animationDuration?: number
  iterations?: number
  padding?: number
  multiline?: boolean
  isView?: boolean
}

export function Highlighter({
  children,
  action = "highlight",
  color = "#ffd1dc",
  strokeWidth = 1.5,
  animationDuration = 600,
  iterations = 2,
  padding = 2,
  multiline = true,
  isView = false,
}: HighlighterProps) {
  const elementRef = useRef<HTMLSpanElement>(null)
  const annotationRef = useRef<RoughAnnotation | null>(null)
  const isAnnotatedRef = useRef(false)
  const configRef = useRef<string>('')

  const isInView = useInView(elementRef, {
    once: true,
    margin: "-10%",
  })

  // If isView is false, always show. If isView is true, wait for inView
  const shouldShow = !isView || isInView

  useEffect(() => {
    if (!shouldShow) return

    const element = elementRef.current
    if (!element) return

    // Create a config string to check if config changed
    const annotationConfig = {
      type: action,
      color,
      strokeWidth,
      animationDuration,
      iterations,
      padding,
      multiline,
    }
    
    const configString = JSON.stringify(annotationConfig)
    
    // If annotation already exists and config hasn't changed, don't recreate
    if (isAnnotatedRef.current && annotationRef.current && configRef.current === configString) {
      return
    }

    // Clean up any existing annotation first
    if (annotationRef.current) {
      try {
        annotationRef.current.remove()
      } catch (e) {
        // Ignore cleanup errors
      }
      annotationRef.current = null
      isAnnotatedRef.current = false
    }

    // Small delay to ensure DOM is ready
    const timeoutId = setTimeout(() => {
      const element = elementRef.current
      if (!element) return

      try {
        const annotation = annotate(element, annotationConfig)
        annotationRef.current = annotation
        configRef.current = configString
        
        // Use requestAnimationFrame to avoid blocking
        requestAnimationFrame(() => {
          if (annotationRef.current === annotation && elementRef.current) {
            annotation.show()
            isAnnotatedRef.current = true
          }
        })
      } catch (error) {
        console.warn('Failed to create annotation:', error)
      }
    }, 50) // Small delay to prevent flickering

    return () => {
      clearTimeout(timeoutId)
      if (annotationRef.current) {
        try {
          annotationRef.current.remove()
        } catch (e) {
          // Ignore cleanup errors
        }
        annotationRef.current = null
        isAnnotatedRef.current = false
      }
    }
  }, [
    shouldShow,
    action,
    color,
    strokeWidth,
    animationDuration,
    iterations,
    padding,
    multiline,
  ])

  return (
    <span ref={elementRef} className="relative inline bg-transparent">
      {children}
    </span>
  )
}
