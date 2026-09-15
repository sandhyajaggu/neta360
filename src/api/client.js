import { API_BASE_URL, DEMO_MODE } from '../config';
import { demoRequest } from './demo';
import { ApiError } from './errors';

export { ApiError };

let authToken = null;
export function setToken(token) {
  authToken = token;
}

function readDetail(data, status) {
  if (data && typeof data.detail === 'string') return data.detail;
  if (data && Array.isArray(data.detail) && data.detail[0]?.msg) return data.detail[0].msg;
  return `Server error (${status}). Try again in a few minutes.`;
}

async function request(path, { method = 'GET', body } = {}) {
  if (DEMO_MODE) return demoRequest(path, method, body);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);
  try {
    const res = await fetch(API_BASE_URL + path, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    const text = await res.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = null;
    }
    if (!res.ok) throw new ApiError(readDetail(data, res.status), res.status);
    return data;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    if (err.name === 'AbortError') {
      throw new ApiError('The server took too long to respond. Check the signal and try again.', 0);
    }
    throw new ApiError('Cannot reach the server. Check your internet connection.', 0);
  } finally {
    clearTimeout(timer);
  }
}

export const api = {
  login: (phone, password) => request('/api/mobile/auth/login', { method: 'POST', body: { phone, password } }),
  pull: (notificationsSince) =>
    request(
      '/api/mobile/sync/pull' +
        (notificationsSince ? `?notifications_since=${encodeURIComponent(notificationsSince)}` : '')
    ),
  push: (ops) => request('/api/mobile/sync/push', { method: 'POST', body: { ops } }),
  sendMobileOtp: (voterId, mobileNumber) =>
    request('/api/mobile/voters/otp/send', { method: 'POST', body: { voter_id: voterId, mobile_number: mobileNumber } }),
  verifyMobileOtp: (voterId, mobileNumber, otp) =>
    request('/api/mobile/voters/otp/verify', { method: 'POST', body: { voter_id: voterId, mobile_number: mobileNumber, otp } }),
};
