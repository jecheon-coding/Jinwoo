import { useEffect } from 'react';
import { useRouter } from 'next/router';

export default function Home() {
  const router = useRouter();
  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    router.replace(`/daily/${today}`);
  }, []);
  return null;
}
