import React, { useEffect } from 'react';
import Navbar from './components/Navbar';
import Home from './components/Home';
import Resume from './components/Resume';
import Projects from './components/Projects';
import './App.css';

function App() {
  useEffect(() => {
    // Set the background to black once when the component mounts
    document.body.style.background = "#111111";

    // Intersection Observer to add 'visible' class to sections
    const sections = document.querySelectorAll('.section, .projects-section');
    const observerOptions = { root: null, threshold: 0.2 };
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
        } else {
          entry.target.classList.remove('visible');
        }
      });
    }, observerOptions);
    sections.forEach((section) => observer.observe(section));

    return () => {
      sections.forEach((section) => observer.unobserve(section));
    };
  }, []);

  return (
    <div className="App">
      <Navbar />
      <Home />
      <Projects />
      <Resume />
    </div>
  );
}

export default App;
