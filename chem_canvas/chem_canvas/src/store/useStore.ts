import { create } from 'zustand';

// --- Types ---

interface CustomizationState {
    isOpen: string[];
    fontFamily: string;
    borderRadius: number;
    opened: boolean;
    isHorizontal: boolean;
    isDarkMode: boolean;
}

interface CanvasState {
    isDirty: boolean;
    chatflow: any | null;
    canvasDialogShow: boolean;
    componentNodes: any[];
    componentCredentials: any[];
}

interface Notification {
    key: string | number;
    message: string;
    options?: {
        key?: string | number;
        variant?: 'default' | 'error' | 'success' | 'warning' | 'info';
        persist?: boolean;
        autoHideDuration?: number;
        [key: string]: any;
    };
    dismissed?: boolean;
}

interface NotifierState {
    notifications: Notification[];
}

interface DialogState {
    show: boolean;
    title: string;
    description: string;
    confirmButtonName: string;
    cancelButtonName: string;
    customBtnId: string;
}

interface UserProfile {
    name?: string;
    email?: string;
    assignedWorkspaces?: any[];
    [key: string]: any;
}

interface AuthState {
    user: UserProfile | null;
    isAuthenticated: boolean;
    isGlobal: boolean;
    token: string | null;
    permissions: any | null;
    features: any | null;
}

// Combine all state slices
interface AppState {
    customization: CustomizationState;
    canvas: CanvasState;
    notifier: NotifierState;
    dialog: DialogState;
    auth: AuthState;

    // Actions
    // Customization Actions
    setMenu: (opened: boolean) => void;
    menuOpen: (id: string) => void;
    setFontFamily: (fontFamily: string) => void;
    setBorderRadius: (borderRadius: number) => void;
    setLayout: (isHorizontal: boolean) => void;
    setDarkMode: (isDarkMode: boolean) => void;

    // Canvas Actions
    setDirty: () => void;
    removeDirty: () => void;
    setChatflow: (chatflow: any) => void;
    showCanvasDialog: () => void;
    hideCanvasDialog: () => void;
    setComponentNodes: (nodes: any[]) => void;
    setComponentCredentials: (credentials: any[]) => void;

    // Notifier Actions
    enqueueSnackbar: (notification: Omit<Notification, 'key'> & { key?: string | number }) => void;
    closeSnackbar: (key?: string | number) => void;
    removeSnackbar: (key: string | number) => void;

    // Dialog Actions
    showConfirm: (payload: { title: string; description: string; confirmButtonName?: string; cancelButtonName?: string }) => void;
    hideConfirm: () => void;

    // Auth Actions
    loginSuccess: (payload: any) => void;
    logoutSuccess: () => void;
    userProfileUpdated: (payload: any) => void;
    workspaceNameUpdated: (payload: { id: string; name: string }) => void;
}

// --- Initial States ---

const initialCustomizationState: CustomizationState = {
    isOpen: [],
    fontFamily: 'Inter, sans-serif',
    borderRadius: 8,
    opened: true,
    isHorizontal: localStorage.getItem('isHorizontal') === 'true',
    isDarkMode: localStorage.getItem('isDarkMode') === 'true',
};

const initialCanvasState: CanvasState = {
    isDirty: false,
    chatflow: null,
    canvasDialogShow: false,
    componentNodes: [],
    componentCredentials: [],
};

const initialNotifierState: NotifierState = {
    notifications: [],
};

const initialDialogState: DialogState = {
    show: false,
    title: '',
    description: '',
    confirmButtonName: 'OK',
    cancelButtonName: 'Cancel',
    customBtnId: '',
};

const initialAuthState: AuthState = {
    user: localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user')!) : null,
    isAuthenticated: localStorage.getItem('isAuthenticated') === 'true',
    isGlobal: localStorage.getItem('isGlobal') === 'true',
    token: null, // Token usually not persisted in local storage directly for security, or handled by cookie
    permissions: localStorage.getItem('permissions') && localStorage.getItem('permissions') !== 'undefined'
        ? JSON.parse(localStorage.getItem('permissions')!)
        : null,
    features: localStorage.getItem('features') && localStorage.getItem('features') !== 'undefined'
        ? JSON.parse(localStorage.getItem('features')!)
        : null,
};

// --- Store Creation ---

const useStore = create<AppState>((set) => ({
    customization: initialCustomizationState,
    canvas: initialCanvasState,
    notifier: initialNotifierState,
    dialog: initialDialogState,
    auth: initialAuthState,

    // --- Customization Actions ---
    setMenu: (opened) => set((state) => ({ customization: { ...state.customization, opened } })),
    menuOpen: (id) => set((state) => ({ customization: { ...state.customization, isOpen: [id] } })),
    setFontFamily: (fontFamily) => set((state) => ({ customization: { ...state.customization, fontFamily } })),
    setBorderRadius: (borderRadius) => set((state) => ({ customization: { ...state.customization, borderRadius } })),
    setLayout: (isHorizontal) => {
        localStorage.setItem('isHorizontal', String(isHorizontal));
        set((state) => ({ customization: { ...state.customization, isHorizontal } }));
    },
    setDarkMode: (isDarkMode) => {
        localStorage.setItem('isDarkMode', String(isDarkMode));
        set((state) => ({ customization: { ...state.customization, isDarkMode } }));
    },

    // --- Canvas Actions ---
    setDirty: () => set((state) => ({ canvas: { ...state.canvas, isDirty: true } })),
    removeDirty: () => set((state) => ({ canvas: { ...state.canvas, isDirty: false } })),
    setChatflow: (chatflow) => set((state) => ({ canvas: { ...state.canvas, chatflow } })),
    showCanvasDialog: () => set((state) => ({ canvas: { ...state.canvas, canvasDialogShow: true } })),
    hideCanvasDialog: () => set((state) => ({ canvas: { ...state.canvas, canvasDialogShow: false } })),
    setComponentNodes: (componentNodes) => set((state) => ({ canvas: { ...state.canvas, componentNodes } })),
    setComponentCredentials: (componentCredentials) => set((state) => ({ canvas: { ...state.canvas, componentCredentials } })),

    // --- Notifier Actions ---
    enqueueSnackbar: (notification) => {
        const key = notification.key || new Date().getTime() + Math.random();
        const newNotification: Notification = {
            ...notification,
            key,
            options: {
                ...notification.options,
                persist: notification.options?.persist ?? false,
                autoHideDuration: notification.options?.autoHideDuration ?? 5000,
            },
        };
        set((state) => ({
            notifier: {
                ...state.notifier,
                notifications: [...state.notifier.notifications, newNotification],
            },
        }));
    },
    closeSnackbar: (key) =>
        set((state) => ({
            notifier: {
                ...state.notifier,
                notifications: state.notifier.notifications.map((n) =>
                    !key || n.key === key ? { ...n, dismissed: true } : n
                ),
            },
        })),
    removeSnackbar: (key) =>
        set((state) => ({
            notifier: {
                ...state.notifier,
                notifications: state.notifier.notifications.filter((n) => n.key !== key),
            },
        })),

    // --- Dialog Actions ---
    showConfirm: ({ title, description, confirmButtonName = 'OK', cancelButtonName = 'Cancel' }) =>
        set((state) => ({
            dialog: {
                ...state.dialog,
                show: true,
                title,
                description,
                confirmButtonName,
                cancelButtonName,
                customBtnId: 'btn_confirmDeletingApiKey',
            },
        })),
    hideConfirm: () => set((state) => ({ dialog: initialDialogState })),

    // --- Auth Actions ---
    loginSuccess: (payload) => {
        // Mimic AuthUtils.updateStateAndLocalStorage
        const { user, token, permissions, features } = payload; // Adjust based on actual payload structure
        localStorage.setItem('user', JSON.stringify(user));
        localStorage.setItem('isAuthenticated', 'true');
        // localStorage.setItem('token', token); // If token is managed
        if (permissions) localStorage.setItem('permissions', JSON.stringify(permissions));
        if (features) localStorage.setItem('features', JSON.stringify(features));

        set((state) => ({
            auth: {
                ...state.auth,
                user,
                isAuthenticated: true,
                token: token || state.auth.token,
                permissions: permissions || state.auth.permissions,
                features: features || state.auth.features,
            },
        }));
    },
    logoutSuccess: () => {
        localStorage.removeItem('user');
        localStorage.removeItem('isAuthenticated');
        localStorage.removeItem('permissions');
        localStorage.removeItem('features');
        // localStorage.removeItem('token');

        set((state) => ({
            auth: {
                ...state.auth,
                user: null,
                token: null,
                permissions: null,
                features: null,
                isAuthenticated: false,
                isGlobal: false,
            },
        }));
    },
    userProfileUpdated: (payload) => {
        // Assuming payload contains updated user fields
        set((state) => {
            const updatedUser = { ...state.auth.user, ...payload };
            localStorage.setItem('user', JSON.stringify(updatedUser));
            return { auth: { ...state.auth, user: updatedUser } };
        });
    },
    workspaceNameUpdated: ({ id, name }) => {
        set((state) => {
            if (!state.auth.user) return state;
            const assignedWorkspaces = state.auth.user.assignedWorkspaces?.map((ws: any) =>
                ws.id === id ? { ...ws, name } : ws
            ) || [];
            const updatedUser = { ...state.auth.user, assignedWorkspaces };
            localStorage.setItem('user', JSON.stringify(updatedUser));
            return { auth: { ...state.auth, user: updatedUser } };
        });
    },
}));

export default useStore;
