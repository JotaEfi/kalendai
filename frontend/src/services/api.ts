import axios from 'axios';

const api = axios.create({
  baseURL: '/api'
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry && error.response?.data?.code === 'TOKEN_EXPIRED') {
      originalRequest._retry = true;
      try {
        const refreshToken = localStorage.getItem('@KalendAI:refreshToken');
        if (!refreshToken) throw new Error('No refresh token available');

        const { data } = await axios.post('/api/auth/refresh', { refreshToken });
        
        localStorage.setItem('@KalendAI:token', data.accessToken);
        api.defaults.headers.common['Authorization'] = `Bearer ${data.accessToken}`;
        originalRequest.headers['Authorization'] = `Bearer ${data.accessToken}`;
        
        return api(originalRequest);
      } catch (refreshError) {
        // Handle failed refresh
        localStorage.removeItem('@KalendAI:token');
        localStorage.removeItem('@KalendAI:refreshToken');
        localStorage.removeItem('@KalendAI:user');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }
    return Promise.reject(error);
  }
);

export default api;
