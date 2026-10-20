"use client"

import { useEffect, useState } from "react"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "lucide-react"
import styles from "./sonner.module.css"

/** Follows the site theme set on <html data-theme> by lib/theme, so toasts match without next-themes. */
function useSiteTheme(): ToasterProps["theme"] {
  const [theme, setTheme] = useState<ToasterProps["theme"]>("light")
  useEffect(() => {
    const read = () => setTheme(document.documentElement.dataset.theme === "dark" ? "dark" : "light")
    read()
    const observer = new MutationObserver(read)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] })
    return () => observer.disconnect()
  }, [])
  return theme
}

const Toaster = ({ ...props }: ToasterProps) => {
  const theme = useSiteTheme()

  return (
    <Sonner
      theme={theme}
      className={`zs toaster group ${styles.toaster}`}
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "var(--zs-raised)",
          "--normal-text": "var(--zs-fg)",
          "--normal-border": "var(--zs-line)",
          "--border-radius": "0",
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
