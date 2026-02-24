import axios from 'axios';

export const apiClient = axios.create({
  baseURL: 'http://localhost:8742/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
});
