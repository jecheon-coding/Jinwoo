import Layout from '../components/Layout';
import '../styles/globals.css';

export default function App({ Component, pageProps }) {
  if (Component.noLayout) return <Component {...pageProps} />;
  return (
    <Layout role={pageProps.role}>
      <Component {...pageProps} />
    </Layout>
  );
}
