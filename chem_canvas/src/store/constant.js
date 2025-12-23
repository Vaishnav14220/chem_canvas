// constant
import {
    Library,
    Wrench,
    Sigma,
    MessageCircle,
    Bot,
    Split,
    Play,
    Sparkles,
    UserCog,
    Repeat,
    ListTodo,
    StickyNote,
    Globe,
    Network,
    Spline
} from 'lucide-react'

export const gridSpacing = 3
export const drawerWidth = 260
export const appDrawerWidth = 320
export const headerHeight = 80
export const maxScroll = 100000
export const baseURL = import.meta.env.VITE_API_BASE_URL || window.location.origin
export const uiBaseURL = import.meta.env.VITE_UI_BASE_URL || window.location.origin
export const FLOWISE_CREDENTIAL_ID = 'FLOWISE_CREDENTIAL_ID'
export const REDACTED_CREDENTIAL_VALUE = '_FLOWISE_BLANK_07167752-1a71-43b1-bf8f-4f32252165db'
export const ErrorMessage = {
    INVALID_MISSING_TOKEN: 'Invalid or Missing token',
    TOKEN_EXPIRED: 'Token Expired',
    REFRESH_TOKEN_EXPIRED: 'Refresh Token Expired',
    FORBIDDEN: 'Forbidden',
    UNKNOWN_USER: 'Unknown Username or Password',
    INCORRECT_PASSWORD: 'Incorrect Password',
    INACTIVE_USER: 'Inactive User',
    INVALID_WORKSPACE: 'No Workspace Assigned',
    UNKNOWN_ERROR: 'Unknown Error'
}
export const AGENTFLOW_ICONS = [
    {
        name: 'conditionAgentflow',
        icon: Split,
        color: '#FFB938'
    },
    {
        name: 'startAgentflow',
        icon: Play,
        color: '#7EE787'
    },
    {
        name: 'llmAgentflow',
        icon: Sparkles,
        color: '#64B5F6'
    },
    {
        name: 'agentAgentflow',
        icon: Bot,
        color: '#4DD0E1'
    },
    {
        name: 'humanInputAgentflow',
        icon: UserCog,
        color: '#6E6EFD'
    },
    {
        name: 'loopAgentflow',
        icon: Repeat,
        color: '#FFA07A'
    },
    {
        name: 'directReplyAgentflow',
        icon: MessageCircle,
        color: '#4DDBBB'
    },
    {
        name: 'customFunctionAgentflow',
        icon: Sigma,
        color: '#E4B7FF'
    },
    {
        name: 'toolAgentflow',
        icon: Wrench,
        color: '#d4a373'
    },
    {
        name: 'retrieverAgentflow',
        icon: Library,
        color: '#b8bedd'
    },
    {
        name: 'conditionAgentAgentflow',
        icon: ListTodo,
        color: '#ff8fab'
    },
    {
        name: 'stickyNoteAgentflow',
        icon: StickyNote,
        color: '#fee440'
    },
    {
        name: 'httpAgentflow',
        icon: Globe,
        color: '#FF7F7F'
    },
    {
        name: 'iterationAgentflow',
        icon: Network,
        color: '#9C89B8'
    },
    {
        name: 'executeFlowAgentflow',
        icon: Spline,
        color: '#a3b18a'
    }
]
