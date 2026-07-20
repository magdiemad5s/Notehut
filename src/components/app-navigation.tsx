'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  BarChart3,
  BookOpen,
  FileText,
  LayoutDashboard,
  MessageSquare,
  Settings,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type AppNavLink = {
  href: string
  label: string
  icon: LucideIcon
}

const navLinks: AppNavLink[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/documents', label: 'Documents', icon: FileText },
  { href: '/chat', label: 'Chat', icon: MessageSquare },
  { href: '/topics', label: 'Topics', icon: BookOpen },
  { href: '/weaknesses', label: 'Weaknesses', icon: BarChart3 },
  { href: '/settings', label: 'Settings', icon: Settings },
]

const adminLink: AppNavLink = {
  href: '/admin',
  label: 'Admin',
  icon: ShieldCheck,
}

export function AppNavigation({ isAdmin = false }: { isAdmin?: boolean }) {
  const pathname = usePathname()
  const links = isAdmin ? [...navLinks, adminLink] : navLinks

  return (
    <div className="flex min-w-max items-center gap-0.5 sm:gap-1">
      {links.map((link) => {
        const active = pathname === link.href || pathname.startsWith(`${link.href}/`)
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              buttonVariants({ variant: 'ghost' }),
              'group/nav-link size-11 shrink-0 whitespace-nowrap rounded-lg px-0 text-muted-foreground sm:size-10 lg:h-8 lg:w-auto lg:px-3',
              'hover:bg-muted/80 hover:text-foreground focus-visible:border-primary/40 focus-visible:ring-primary/20',
              active && 'bg-primary/10 font-semibold text-primary hover:bg-primary/15 hover:text-primary',
            )}
            title={link.label}
          >
            <link.icon className="size-[1.1rem] transition-transform group-hover/nav-link:-translate-y-px lg:size-4" aria-hidden="true" />
            <span className="sr-only lg:not-sr-only">{link.label}</span>
          </Link>
        )
      })}
    </div>
  )
}
