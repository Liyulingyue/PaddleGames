import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface UserInfo {
  id: number | null
  username: string
  nickname: string
  avatar: string
  isAdmin: boolean
}

interface UserStore {
  user: UserInfo
  isLoggedIn: boolean
  setUser: (user: Partial<UserInfo>) => void
  clearUser: () => void
  login: (user: UserInfo) => void
  logout: () => void
}

export const useUserStore = create<UserStore>()(
  persist(
    (set) => ({
      user: {
        id: null,
        username: '',
        nickname: '',
        avatar: '',
        isAdmin: false,
      },
      isLoggedIn: false,
      setUser: (user) =>
        set((state) => ({
          user: { ...state.user, ...user },
        })),
      clearUser: () =>
        set({
          user: {
            id: null,
            username: '',
            nickname: '',
            avatar: '',
            isAdmin: false,
          },
          isLoggedIn: false,
        }),
      login: (user) =>
        set({
          user,
          isLoggedIn: true,
        }),
      logout: () =>
        set({
          user: {
            id: null,
            username: '',
            nickname: '',
            avatar: '',
            isAdmin: false,
          },
          isLoggedIn: false,
        }),
    }),
    {
      name: 'posematch-user',
    }
  )
)
