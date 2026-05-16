import crypto from 'crypto';

const SECRET = process.env.AUTH_SECRET || 'jinwoo-default-secret-please-change';

export function signRole(role) {
  const sig = crypto.createHmac('sha256', SECRET).update(role).digest('hex').slice(0, 24);
  return `${role}.${sig}`;
}

export function verifyToken(token) {
  if (!token) return null;
  const dot = token.indexOf('.');
  if (dot < 0) return null;
  const role = token.slice(0, dot);
  const sig  = token.slice(dot + 1);
  if (role !== 'admin' && role !== 'user') return null;
  const expected = crypto.createHmac('sha256', SECRET).update(role).digest('hex').slice(0, 24);
  return sig === expected ? role : null;
}

export function getRole(req) {
  const raw = req.headers.cookie || '';
  const m = raw.match(/(?:^|;\s*)jinwoo_auth=([^;]+)/);
  return m ? verifyToken(decodeURIComponent(m[1])) : null;
}

// getServerSideProps 에서 사용하는 헬퍼
export function requireAuth(req, adminOnly = false) {
  const role = getRole(req);
  if (!role) return { redirect: { destination: '/login', permanent: false } };
  if (adminOnly && role !== 'admin') return { redirect: { destination: '/daily', permanent: false } };
  return null; // 통과
}
