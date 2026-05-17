import Head from 'next/head';
import Layout from '../components/Layout';
import '../styles/globals.css';

export default function App({ Component, pageProps }) {
  return (
    <>
      <Head>
        <title>진우환경 일일 작업일지</title>
        <meta name="description" content="진우환경 일일 작업일지" />
        <meta property="og:title" content="진우환경 일일 작업일지" />
        <meta property="og:description" content="진우환경 일일 작업일지" />
        <meta property="og:type" content="website" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      {Component.noLayout
        ? <Component {...pageProps} />
        : <Layout role={pageProps.role}><Component {...pageProps} /></Layout>
      }
    </>
  );
}
