// src/api/axios.js
// Creates a pre-configured axios instance with the Flask backend URL baked in.
// Think of this like a Java HttpClient configured with a base URL —
// every API call in the app imports this instead of raw axios.

import axios from 'axios'

const api = axios.create({
  baseURL: 'http://localhost:5001/api',
})

// This is an "interceptor" — it runs before every request automatically.
// It reads the JWT token from localStorage and adds it to the Authorization header.
// Think of it like a Java filter that runs on every outgoing request.
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

export default api