import { requireAuth, getRole } from '../lib/auth';

export async function getServerSideProps({ req }) {
  const authRedirect = requireAuth(req, false);
  if (authRedirect) return authRedirect;

  const role = getRole(req);
  const today = new Date().toISOString().slice(0, 10);
  return { redirect: { destination: `/daily/${today}`, permanent: false } };
}

export default function Home() {
  return null;
}
