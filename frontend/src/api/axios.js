import axios from 'axios'

// We define the URL first, then pass it into the config object
const API_URL = import.meta.env.VITE_API_URL || 'https://buckeyematch.onrender.com/api';

const api = axios.create({
  baseURL: API_URL
})

// Keep your interceptor as it was
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

export default api