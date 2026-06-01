import React, { useEffect, useState, lazy, Suspense } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar';
import Home from './components/Home';
import Projects from './components/Projects';
import Footer from './components/Footer';
import Cursor from './components/Cursor';
import Personal, { PersonalTrigger } from './components/Personal';
import { trackPage } from './analytics';
import './App.css';

const MLPipelineShowcase = lazy(() => import('./components/MLPipelineShowcase'));
const CodeCollab          = lazy(() => import('./components/CodeCollab/CodeCollab'));
const LensShowcase        = lazy(() => import('./components/Lens/LensShowcase'));
const PrismShowcase       = lazy(() => import('./components/Prism/PrismShowcase'));
const CurrencyShowcase    = lazy(() => import('./components/Currency/CurrencyShowcase'));
const FluxShowcase        = lazy(() => import('./components/Flux/FluxShowcase'));
const AnalyticsDashboard  = lazy(() => import('./components/Analytics/AnalyticsDashboard'));

const PAGE_TITLES = {
  '/':                   'Portfolio — Adam Dsouza',
  '/projects/sentinel':  'Sentinel Showcase',
  '/projects/codecollab':'CodeCollab Showcase',
  '/projects/lens':      'Lens Showcase',
  '/projects/prism':     'Prism Showcase',
  '/projects/currency':  'Currency Showcase',
  '/projects/flux':      'Flux — Universal Converter',
};

function PageTracker() {
  const location = useLocation();
  useEffect(() => {
    const title = PAGE_TITLES[location.pathname] || document.title;
    trackPage(location.pathname, title);
  }, [location.pathname]);
  return null;
}

function Portfolio() {
  const [personalOpen, setPersonalOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    if (location.state?.scrollTo) {
      const el = document.getElementById(location.state.scrollTo);
      if (el) {
        const y = el.getBoundingClientRect().top + window.pageYOffset;
        window.scrollTo({ top: y, behavior: 'smooth' });
      }
    }
  }, [location.state]);

  useEffect(() => {
    const sections = document.querySelectorAll('.section, .projects-section, .footer, .personal-trigger-section');
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) entry.target.classList.add('visible');
          else entry.target.classList.remove('visible');
        });
      },
      { root: null, threshold: 0.12 }
    );
    sections.forEach((s) => observer.observe(s));
    return () => sections.forEach((s) => observer.unobserve(s));
  }, []);

  return (
    <div className="App">
      <Cursor />
      <Navbar />
      <Home />
      <Projects />
      <PersonalTrigger onOpen={() => setPersonalOpen(true)} />
      <Footer />
      <Personal isOpen={personalOpen} onClose={() => setPersonalOpen(false)} />
    </div>
  );
}

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
}

function ShowcasePage({ component: Component }) {
  return (
    <Suspense fallback={<div className="showcase-loading">Loading...</div>}>
      <ScrollToTop />
      <Component />
    </Suspense>
  );
}

function App() {
  return (
    <>
      <PageTracker />
      <Routes>
        <Route path="/"                    element={<Portfolio />} />
        <Route path="/projects/sentinel"   element={<ShowcasePage component={MLPipelineShowcase} />} />
        <Route path="/projects/codecollab" element={<ShowcasePage component={CodeCollab} />} />
        <Route path="/projects/lens"       element={<ShowcasePage component={LensShowcase} />} />
        <Route path="/projects/prism"      element={<ShowcasePage component={PrismShowcase} />} />
        <Route path="/projects/currency"   element={<ShowcasePage component={CurrencyShowcase} />} />
        <Route path="/projects/flux"       element={<ShowcasePage component={FluxShowcase} />} />
        <Route path="/analytics"           element={<ShowcasePage component={AnalyticsDashboard} />} />
      </Routes>
    </>
  );
}

export default App;
