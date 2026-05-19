import { Inter, Source_Serif_4 } from "next/font/google";

import "@/styles/globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap"
});

const sourceSerif = Source_Serif_4({
  subsets: ["latin"],
  variable: "--font-serif",
  display: "swap",
  weight: ["400", "600", "700"]
});

export default function App({ Component, pageProps }) {
  return (
    <div className={`${inter.variable} ${sourceSerif.variable} font-sans antialiased`}>
      <Component {...pageProps} />
    </div>
  );
}
