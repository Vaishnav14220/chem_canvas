"use client"

import * as React from "react"
import {
    BookOpen,
    FlaskConical,
    GraduationCap,
    // LayoutDashboard,
    LineChart,
    MessagesSquare,
    Microscope,
    PanelsTopLeft,
    Pencil,
    Play,
    Settings,
    Sparkles,
    Video,
    Atom,
    FileText,
    Brain,
    Lightbulb,
    // MessageCircle,
    ChevronDown,
    type LucideIcon,
} from "lucide-react"

import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarMenuSub,
    SidebarMenuSubButton,
    SidebarMenuSubItem,
    SidebarRail,
} from "./ui/sidebar"
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "./ui/collapsible"

// Types
interface NavItem {
    id: string
    title: string
    icon: LucideIcon
    isActive?: boolean
    subItems?: { id: string; title: string }[]
}

interface NavGroup {
    label: string
    items: NavItem[]
}

interface AppSidebarProps {
    activeFeatureId?: string
    onFeatureSelect?: (featureId: string) => void
    user?: { email?: string; displayName?: string } | null
}

// Navigation configuration
const navGroups: NavGroup[] = [
    {
        label: "Workspace",
        items: [
            {
                id: "workspace-view",
                title: "Canvas",
                icon: PanelsTopLeft,
            },
            {
                id: "excalidraw",
                title: "Whiteboard",
                icon: Pencil,
            },
            {
                id: "planner",
                title: "Planner",
                icon: LineChart,
            },
        ],
    },
    {
        label: "Learning Modes",
        items: [
            {
                id: "socratic",
                title: "Socratic Mode",
                icon: MessagesSquare,
            },
            {
                id: "feynman",
                title: "Feynman Mode",
                icon: Lightbulb,
            },
            {
                id: "pdf-study",
                title: "PDF Study",
                icon: FileText,
            },
        ],
    },
    {
        label: "Study Tools",
        items: [
            {
                id: "immersive-learning",
                title: "Immersive Learning",
                icon: Sparkles,
                subItems: [
                    { id: "assignment", title: "Assignment" },
                    { id: "notebook", title: "Notebook" },
                    { id: "immersive-text", title: "Immersive Text" },
                ],
            },
            {
                id: "ai-word",
                title: "AI Word",
                icon: BookOpen,
            },
            {
                id: "quiz",
                title: "Quiz & Flashcards",
                icon: Brain,
            },
        ],
    },
    {
        label: "Chemistry Tools",
        items: [
            {
                id: "molecular-viewer",
                title: "Molecular Viewer",
                icon: Atom,
            },
            {
                id: "periodic-table",
                title: "Periodic Table",
                icon: FlaskConical,
            },
            {
                id: "nmr-workspace",
                title: "NMR Workspace",
                icon: Microscope,
            },
        ],
    },
    {
        label: "Media",
        items: [
            {
                id: "youtube-videos",
                title: "YouTube Videos",
                icon: Video,
            },
            {
                id: "audio-video",
                title: "Audio/Video",
                icon: Play,
            },
        ],
    },
]

export function AppSidebar({
    activeFeatureId,
    onFeatureSelect,
    user,
}: AppSidebarProps) {
    const handleSelect = React.useCallback(
        (featureId: string) => {
            onFeatureSelect?.(featureId)
        },
        [onFeatureSelect]
    )

    return (
        <Sidebar collapsible="icon">
            <SidebarHeader>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton size="lg" asChild>
                            <a href="#">
                                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 text-white">
                                    <GraduationCap className="size-4" />
                                </div>
                                <div className="grid flex-1 text-left text-sm leading-tight">
                                    <span className="truncate font-semibold">ChemCanvas</span>
                                    <span className="truncate text-xs text-muted-foreground">
                                        Learning Platform
                                    </span>
                                </div>
                            </a>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarHeader>
            <SidebarContent>
                {navGroups.map((group) => (
                    <SidebarGroup key={group.label}>
                        <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
                        <SidebarGroupContent>
                            <SidebarMenu>
                                {group.items.map((item) => {
                                    const Icon = item.icon
                                    const isActive = activeFeatureId === item.id

                                    if (item.subItems) {
                                        return (
                                            <Collapsible
                                                key={item.id}
                                                asChild
                                                defaultOpen={item.subItems.some(
                                                    (sub) => sub.id === activeFeatureId
                                                )}
                                                className="group/collapsible"
                                            >
                                                <SidebarMenuItem>
                                                    <CollapsibleTrigger asChild>
                                                        <SidebarMenuButton tooltip={item.title}>
                                                            <Icon />
                                                            <span>{item.title}</span>
                                                            <ChevronDown className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-180" />
                                                        </SidebarMenuButton>
                                                    </CollapsibleTrigger>
                                                    <CollapsibleContent>
                                                        <SidebarMenuSub>
                                                            {item.subItems.map((subItem) => (
                                                                <SidebarMenuSubItem key={subItem.id}>
                                                                    <SidebarMenuSubButton
                                                                        asChild
                                                                        isActive={activeFeatureId === subItem.id}
                                                                    >
                                                                        <button
                                                                            onClick={() => handleSelect(subItem.id)}
                                                                        >
                                                                            <span>{subItem.title}</span>
                                                                        </button>
                                                                    </SidebarMenuSubButton>
                                                                </SidebarMenuSubItem>
                                                            ))}
                                                        </SidebarMenuSub>
                                                    </CollapsibleContent>
                                                </SidebarMenuItem>
                                            </Collapsible>
                                        )
                                    }

                                    return (
                                        <SidebarMenuItem key={item.id}>
                                            <SidebarMenuButton
                                                tooltip={item.title}
                                                isActive={isActive}
                                                onClick={() => handleSelect(item.id)}
                                            >
                                                <Icon />
                                                <span>{item.title}</span>
                                            </SidebarMenuButton>
                                        </SidebarMenuItem>
                                    )
                                })}
                            </SidebarMenu>
                        </SidebarGroupContent>
                    </SidebarGroup>
                ))}
            </SidebarContent>
            <SidebarFooter>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton tooltip="Settings" asChild>
                            <button>
                                <Settings />
                                <span>Settings</span>
                            </button>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                    {user && (
                        <SidebarMenuItem>
                            <SidebarMenuButton size="lg" tooltip={user.email || "User"}>
                                <div className="flex aspect-square size-8 items-center justify-center rounded-full bg-gradient-to-br from-orange-400 to-pink-500 text-white text-xs font-medium">
                                    {(user.displayName || user.email || "U").charAt(0).toUpperCase()}
                                </div>
                                <div className="grid flex-1 text-left text-sm leading-tight">
                                    <span className="truncate font-semibold">
                                        {user.displayName || "User"}
                                    </span>
                                    <span className="truncate text-xs text-muted-foreground">
                                        {user.email || ""}
                                    </span>
                                </div>
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                    )}
                </SidebarMenu>
            </SidebarFooter>
            <SidebarRail />
        </Sidebar>
    )
}

export default AppSidebar
