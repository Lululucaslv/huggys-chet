"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner } from "sonner"

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-pink-200 group-[.toaster]:text-purple-900 group-[.toaster]:border-pink-300 group-[.toaster]:shadow-lg dark:group-[.toaster]:bg-purple-900 dark:group-[.toaster]:text-white dark:group-[.toaster]:border-purple-800",
          description: "group-[.toast]:text-purple-900 dark:group-[.toast]:text-pink-200",
          actionButton:
            "group-[.toast]:bg-purple-900 group-[.toast]:text-white dark:group-[.toast]:bg-pink-200 dark:group-[.toast]:text-purple-900",
          cancelButton:
            "group-[.toast]:bg-pink-200 group-[.toast]:text-purple-900 dark:group-[.toast]:bg-purple-800 dark:group-[.toast]:text-pink-200",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
