// src/context/AuthContext.jsx
// Provides the current user and login/logout functions to the entire app.
//
// In Java you might use a singleton or a static class to hold global state.
// In React, Context is the equivalent — it's a value that any component
// in the app can read without passing it down through props manually.
//
// Usage in any component:
//   const { user, login, logout } = useAuth()

import { createContext, useContext, useState, useEffect } from 'react'
import api from '../api/axios'

// Create the context object — think of this as defining the "shape"
// of the global state that will be shared
const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  // On app load, check if there's a saved token in localStorage.
  // If there is, we can restore the session without making the user log in again.
  // This runs once when the app first mounts — like a Java static initializer.
  useEffect(() => {
    const token = localStorage.getItem('token')
    const savedUser = localStorage.getItem('user')
    if (token && savedUser) {
      setUser(JSON.parse(savedUser))
    }
    setLoading(false)
  }, [])

  const login = (token, userData) => {
    // Save to localStorage so the session survives page refresh
    localStorage.setItem('token', token)
    localStorage.setItem('user', JSON.stringify(userData))
    setUser(userData)
  }

  const logout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

// Custom hook — lets any component call useAuth() instead of
// the more verbose useContext(AuthContext)
export function useAuth() {
  return useContext(AuthContext)
}