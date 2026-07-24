import { useState, useEffect } from "react";
import { I18nProvider } from "../context/I18nContext.jsx";
import Header from "../components/Header.jsx";
import Hero from "../components/Hero.jsx";
import ProductsGrid from "../components/ProductsGrid.jsx";
import HeritageGallery from "../components/HeritageGallery.jsx";
import Divisions from "../components/Divisions.jsx";
import Clients from "../components/Clients.jsx";
import Strip from "../components/Strip.jsx";
import Footer from "../components/Footer.jsx";
import ERPLoginModal from "../components/ERPLoginModal.jsx";

function LandingContent() {
  const [accountOpen, setAccountOpen] = useState(false);

  useEffect(() => {
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          e.target.classList.add("in");
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.06, rootMargin: "0px 0px -48px 0px" });

    document.querySelectorAll(".reveal, .reveal-left, .reveal-right")
      .forEach(el => io.observe(el));

    return () => io.disconnect();
  }, []);

  return (
    <>
      <Header onOpenAccount={() => setAccountOpen(true)} />
      <main>
        <Hero />
        <ProductsGrid />
        <HeritageGallery />
        <Divisions />
        <Clients />
        <Strip />
      </main>
      <Footer />
      <ERPLoginModal open={accountOpen} onClose={() => setAccountOpen(false)} />
    </>
  );
}

export default function LandingPage() {
  return (
    <I18nProvider>
      <LandingContent />
    </I18nProvider>
  );
}
