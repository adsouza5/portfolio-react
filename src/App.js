import React, { useEffect, useState } from 'react';
import Navbar from './components/Navbar';
import Home from './components/Home';
import Projects from './components/Projects';
import Footer from './components/Footer';
import Cursor from './components/Cursor';
import Personal, { PersonalTrigger } from './components/Personal';
import './App.css';

function App() {
  const [personalOpen, setPersonalOpen] = useState(false);

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

export default App;
