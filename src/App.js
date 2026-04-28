import React, { useEffect, useState, lazy, Suspense } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar';
import Home from './components/Home';
import Projects from './components/Projects';
import Footer from './components/Footer';
import Cursor from './components/Cursor';
import Personal, { PersonalTrigger } from './components/Personal';
import './App.css';

const MLPipelineShowcase = lazy(() => import('./components/MLPipelineShowcase'));

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
    const sections = document.querySelectorAll('.section, .projects-section');
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
          } else {
            entry.target.classList.remove('visible');
          }
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

function ShowcasePage({ component: Component }) {
  return (
    <Suspense fallback={<div className="showcase-loading">Loading...</div>}>
      <Component />
    </Suspense>
  );
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<Portfolio />} />
      <Route
        path="/projects/sentinel"
        element={<ShowcasePage component={MLPipelineShowcase} />}
      />
    </Routes>
  );
}

export default App;
