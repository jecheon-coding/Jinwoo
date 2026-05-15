import Layout from '../components/Layout';
import '../styles/globals.css';

export default function App({ Component, pageProps }) {
  const noLayout = Component.noLayout;
  if (noLayout) return <Component {...pageProps} />;
  return (
    <Layout>
      <Component {...pageProps} />
    </Layout>
  );
}
