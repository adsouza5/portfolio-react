import React, { useState, useEffect } from 'react';
import './Navbar.css';

const Navbar = () => {
  const [activeSection, setActiveSection] = useState('home');

  useEffect(() => {
    const sections = ['home', 'projects', 'contact'];

    const handleScroll = () => {
      let current = 'home';
      sections.forEach((id) => {
        const el = document.getElementById(id);
        if (el) {
          const rect = el.getBoundingClientRect();
          if (rect.top <= 100 && rect.bottom >= 100) current = id;
        }
      });
      setActiveSection(current);
    };

    window.addEventListener('scroll', handleScroll);
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  /* Scroll to the section top so the heading + first card land naturally in view */
  const scrollToTimeline = (e) => {
    e.preventDefault();
    const section = document.getElementById('projects');
    if (!section) return;
    const y = section.getBoundingClientRect().top + window.pageYOffset;
    window.scrollTo({ top: y, behavior: 'smooth' });
  };

  return (
    <nav className="navbar" aria-label="Page navigation">

      <a href="#home" className={`nav-item${activeSection === 'home' ? ' active' : ''}`}>
        <span className="nav-label">Home</span>
        <span className="nav-dot" />
      </a>

      <a
        href="#projects"
        className={`nav-item${activeSection === 'projects' ? ' active' : ''}`}
        onClick={scrollToTimeline}
      >
        <span className="nav-label">Timeline</span>
        <span className="nav-dot" />
      </a>

      <a href="#contact" className={`nav-item${activeSection === 'contact' ? ' active' : ''}`}>
        <span className="nav-label">Contact</span>
        <span className="nav-dot" />
      </a>

      <div className="nav-divider" />

      <a
        href="https://www.linkedin.com/in/adam-dsouza/"
        target="_blank"
        rel="noopener noreferrer"
        className="nav-item nav-item--external"
      >
        <span className="nav-label">LinkedIn</span>
        <span className="nav-dot" />
      </a>
      <a
        href="https://github.com/adsouza5"
        target="_blank"
        rel="noopener noreferrer"
        className="nav-item nav-item--external"
      >
        <span className="nav-label">GitHub</span>
        <span className="nav-dot" />
      </a>
      <a
        href="/images/resume.jpg"
        target="_blank"
        rel="noopener noreferrer"
        className="nav-item nav-item--external"
      >
        <span className="nav-label">Resume</span>
        <span className="nav-dot" />
      </a>

    </nav>
  );
};

export default Navbar;
